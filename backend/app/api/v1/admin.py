import secrets
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from typing import Literal

import httpx

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.admin import require_admin
from app.core.config import settings
from app.core.database import get_db
from app.core.document_generator import fill_counseling_template
from app.core.email import send_final_to_user
from app.core.gemini_client import generate_counseling_draft, is_dummy_draft
from app.core.health import run_all_checks
from app.core.pdf import PDF_DIR, convert_office_to_pdf
from app.models.community import Notice, Post
from app.models.counseling import CounselingStatus, CounselingSurvey
from app.models.course import Course
from app.models.document import IssuedDocument, IssuedDocumentStatus, IssuedDocumentType
from app.models.enrollment import Enrollment
from app.models.faq import Faq
from app.models.lecture import Lecture
from app.models.order import Order, OrderStatus, OrderType
from app.models.quiz import Quiz, QuizOption, QuizQuestion
from app.models.user import User
from app.schemas.admin import (
    AdminOrderRow,
    AdminOrdersResponse,
    AdminStats,
    AdminSurveyDetail,
    AdminSurveyRow,
    AdminUser,
    AdminUserEnrollmentRow,
    AdminUsersResponse,
    LectureProgressDetail,
    CourseCreate,
    CourseEnrollmentCount,
    CoursePatch,
    LectureCreate,
    LectureFull,
    LecturePatch,
    AdminActivity,
    AdminTopCourse,
    AdminUserBrief,
    HealthResponse,
    NoticePatch,
    OkResponse,
    PostPatch,
    QuizRead,
    QuizSet,
    SalesStats,
    SalesStatsByCourse,
    SalesStatsByPayment,
    SalesStatsDaily,
    VisitorStats,
)
from app.schemas.community import NoticeDetail, PostAdminReply, PostDetail
from app.schemas.course import CourseDetail, CourseListItem, LectureItem
from app.schemas.document import DocumentResponse
from app.schemas.faq import FaqCreate, FaqPatch, FaqRead

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

FINALS_DIR = Path(__file__).resolve().parents[3] / "static" / "finals"
EXPORTS_DIR = Path(__file__).resolve().parents[3] / "static" / "exports"
DRAFTS_DIR = Path(__file__).resolve().parents[3] / "static" / "drafts"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _row_from_order(o: Order, user: User, course: Course) -> AdminOrderRow:
    return AdminOrderRow(
        id=o.id,
        user_id=user.id,
        username=user.username,
        email=user.email,
        course_title=course.title,
        amount=o.amount,
        payment_method=o.payment_method,
        status=o.status,
        created_at=o.created_at,
    )


# ---------- users -------------------------------------------------------------


@router.get("/users", response_model=AdminUsersResponse)
def list_users(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=200),
    course_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> AdminUsersResponse:
    # course_id 가 오면 해당 강의를 수강 등록한 사용자만 필터링 (사이드바 "강의별
    # 수강생" 클릭). user_id+course_id 에 unique constraint 가 있어 join 해도
    # row 가 중복되지 않는다.
    user_query = select(User)
    count_query = select(func.count(User.id))
    if course_id is not None:
        user_query = user_query.join(Enrollment, Enrollment.user_id == User.id).where(
            Enrollment.course_id == course_id
        )
        count_query = count_query.join(
            Enrollment, Enrollment.user_id == User.id
        ).where(Enrollment.course_id == course_id)

    total = db.scalar(count_query) or 0
    items = list(
        db.scalars(
            user_query.order_by(User.id.desc())
            .offset((page - 1) * size)
            .limit(size)
        ).all()
    )
    if not items:
        return AdminUsersResponse(items=[], total=total, page=page, size=size)

    user_ids = [u.id for u in items]

    enroll_counts: dict[int, int] = dict(
        db.execute(
            select(Enrollment.user_id, func.count(Enrollment.id))
            .where(Enrollment.user_id.in_(user_ids))
            .group_by(Enrollment.user_id)
        ).all()
    )
    pay_rows = db.execute(
        select(
            Order.user_id,
            func.count(Order.id),
            func.coalesce(func.sum(Order.amount), 0),
        )
        .where(Order.user_id.in_(user_ids), Order.status == OrderStatus.PAID)
        .group_by(Order.user_id)
    ).all()
    pay_counts: dict[int, int] = {uid: cnt for uid, cnt, _ in pay_rows}
    pay_amounts: dict[int, int] = {uid: amt for uid, _, amt in pay_rows}

    out: list[AdminUser] = []
    for u in items:
        out.append(
            AdminUser(
                id=u.id,
                username=u.username,
                email=u.email,
                name=u.name,
                phone=u.phone,
                birth_date=u.birth_date,
                is_active=u.is_active,
                is_admin=u.is_admin,
                created_at=u.created_at,
                enrollment_count=enroll_counts.get(u.id, 0),
                payment_count=pay_counts.get(u.id, 0),
                total_payment=pay_amounts.get(u.id, 0),
            )
        )
    return AdminUsersResponse(items=out, total=total, page=page, size=size)


@router.get("/users/{user_id}/enrollments", response_model=list[AdminUserEnrollmentRow])
def admin_user_enrollments(
    user_id: int, db: Session = Depends(get_db)
) -> list[AdminUserEnrollmentRow]:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다.")

    enrollments = list(
        db.scalars(
            select(Enrollment)
            .where(Enrollment.user_id == user_id)
            .options(selectinload(Enrollment.progresses))
            .order_by(Enrollment.enrolled_at.desc())
        ).all()
    )
    if not enrollments:
        return []

    course_ids = [e.course_id for e in enrollments]
    courses_map = {
        c.id: c
        for c in db.scalars(
            select(Course)
            .where(Course.id.in_(course_ids))
            .options(selectinload(Course.lectures))
        ).all()
    }

    # 각 enrollment 별 퀴즈 합격 여부
    quiz_pass_rows = db.execute(
        select(Enrollment.id, func.count(Quiz.id))
        .join(Course, Course.id == Enrollment.course_id)
        .join(Quiz, Quiz.course_id == Course.id, isouter=True)
        .where(Enrollment.user_id == user_id)
        .group_by(Enrollment.id)
    ).all()
    has_quiz_map = {eid: cnt > 0 for (eid, cnt) in quiz_pass_rows}

    from app.models.quiz import QuizAttempt as _QA  # 지역 import 로 위 import 충돌 회피
    pass_rows = db.execute(
        select(_QA.enrollment_id)
        .where(
            _QA.enrollment_id.in_([e.id for e in enrollments]),
            _QA.is_passed.is_(True),
        )
        .distinct()
    ).all()
    passed_set = {eid for (eid,) in pass_rows}

    out: list[AdminUserEnrollmentRow] = []
    for e in enrollments:
        course = courses_map.get(e.course_id)
        if course is None:
            continue
        # 진도율 재계산 (course.lectures + e.progresses)
        active_lectures = sorted(
            [lec for lec in course.lectures if lec.is_active],
            key=lambda lec: (lec.order_index, lec.id),
        )
        progress_by_lecture = {p.lecture_id: p for p in e.progresses}
        if not active_lectures:
            pct = 0
        else:
            completed = sum(
                1
                for lec in active_lectures
                if (p := progress_by_lecture.get(lec.id)) is not None and p.is_completed
            )
            pct = int(round(completed * 100 / len(active_lectures)))

        lecture_rows: list[LectureProgressDetail] = []
        for lec in active_lectures:
            p = progress_by_lecture.get(lec.id)
            watched = p.watched_seconds if p is not None else 0
            duration = lec.duration_seconds or 0
            if duration > 0:
                lec_pct = min(100, int(round(watched * 100 / duration)))
            else:
                lec_pct = 100 if (p is not None and p.is_completed) else 0
            lecture_rows.append(
                LectureProgressDetail(
                    lecture_id=lec.id,
                    lecture_title=lec.title,
                    order_index=lec.order_index,
                    watched_seconds=watched,
                    duration_seconds=duration,
                    progress_pct=lec_pct,
                    is_completed=bool(p is not None and p.is_completed),
                )
            )

        # 퀴즈가 없으면 quiz_passed=True 로 취급 (수료 조건에 영향 없음)
        quiz_passed = (
            True if not has_quiz_map.get(e.id, False) else (e.id in passed_set)
        )
        out.append(
            AdminUserEnrollmentRow(
                enrollment_id=e.id,
                course_id=course.id,
                course_title=course.title,
                category=course.category,
                overall_progress_pct=pct,
                is_completed=e.is_completed,
                quiz_passed=quiz_passed,
                expires_at=e.expires_at,
                lectures=lecture_rows,
            )
        )
    return out


@router.post("/enrollments/{enrollment_id}/extend-access", response_model=AdminUserEnrollmentRow)
def extend_enrollment_access(enrollment_id: int, db: Session = Depends(get_db)):
    """수강기간(expires_at) 을 지금부터 ENROLLMENT_ACCESS_DAYS 일 뒤로 재설정.

    기간 만료로 강의를 못 보게 된 사용자의 문의 응대용 — 고객센터에서
    수동으로 연장해줄 수 있는 유일한 경로.
    """
    enrollment = db.get(Enrollment, enrollment_id)
    if enrollment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="수강 등록을 찾을 수 없습니다.")
    enrollment.expires_at = _now() + timedelta(days=settings.ENROLLMENT_ACCESS_DAYS)
    db.commit()

    # 응답은 admin_user_enrollments 와 동일한 형태로 재사용을 위해 재조회.
    rows = admin_user_enrollments(enrollment.user_id, db)
    row = next((r for r in rows if r.enrollment_id == enrollment_id), None)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="수강 등록을 찾을 수 없습니다.")
    return row


# ---------- courses -----------------------------------------------------------


@router.post("/courses", response_model=CourseListItem, status_code=status.HTTP_201_CREATED)
def create_course(payload: CourseCreate, db: Session = Depends(get_db)) -> Course:
    if payload.original_price is not None and payload.original_price <= payload.price:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="정가(할인 전)는 판매가보다 커야 합니다.",
        )
    course = Course(
        title=payload.title,
        description=payload.description,
        category=payload.category,
        price=payload.price,
        original_price=payload.original_price,
        thumbnail_url=payload.thumbnail_url,
        min_progress_pct=payload.min_progress_pct,
        quiz_pass_score=payload.quiz_pass_score,
        is_active=True,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.patch("/courses/{course_id}", response_model=CourseDetail)
def patch_course(
    course_id: int, payload: CoursePatch, db: Session = Depends(get_db)
) -> CourseDetail:
    course = db.scalar(
        select(Course).where(Course.id == course_id).options(selectinload(Course.lectures))
    )
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="강의를 찾을 수 없습니다.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(course, field, value)
    if course.original_price is not None and course.original_price <= (course.price or 0):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="정가(할인 전)는 판매가보다 커야 합니다.",
        )
    db.commit()
    db.refresh(course)
    return CourseDetail(
        id=course.id,
        title=course.title,
        category=course.category,
        thumbnail_url=course.thumbnail_url,
        price=course.price,
        original_price=course.original_price,
        is_active=course.is_active,
        description=course.description,
        min_progress_pct=course.min_progress_pct,
        quiz_pass_score=course.quiz_pass_score,
        lectures=[LectureItem.model_validate(l) for l in course.lectures if l.is_active],
    )


@router.post(
    "/courses/{course_id}/lectures",
    response_model=LectureItem,
    status_code=status.HTTP_201_CREATED,
)
def add_lecture(
    course_id: int, payload: LectureCreate, db: Session = Depends(get_db)
) -> Lecture:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="강의를 찾을 수 없습니다.")
    # order_index 는 자동 할당: 현재 lecture 수 + 1.
    # 페이로드의 값은 무시 (어드민 UI 가 더 이상 보내지 않음).
    existing_count = db.scalar(
        select(func.count(Lecture.id)).where(Lecture.course_id == course.id)
    ) or 0
    lecture = Lecture(
        course_id=course.id,
        title=payload.title,
        order_index=existing_count + 1,
        video_url=payload.video_url,
        duration_seconds=payload.duration_seconds,
        is_active=True,
    )
    db.add(lecture)
    db.commit()
    db.refresh(lecture)
    return lecture


@router.get("/courses/{course_id}/lectures", response_model=list[LectureFull])
def list_course_lectures(course_id: int, db: Session = Depends(get_db)) -> list[Lecture]:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="강의를 찾을 수 없습니다.")
    return list(
        db.scalars(
            select(Lecture)
            .where(Lecture.course_id == course_id)
            .order_by(Lecture.order_index, Lecture.id)
        ).all()
    )


@router.patch("/lectures/{lecture_id}", response_model=LectureFull)
def patch_lecture(
    lecture_id: int, payload: LecturePatch, db: Session = Depends(get_db)
) -> Lecture:
    lecture = db.get(Lecture, lecture_id)
    if lecture is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="영상을 찾을 수 없습니다.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(lecture, field, value)
    db.commit()
    db.refresh(lecture)
    return lecture


@router.delete("/lectures/{lecture_id}", response_model=OkResponse)
def delete_lecture(lecture_id: int, db: Session = Depends(get_db)) -> OkResponse:
    lecture = db.get(Lecture, lecture_id)
    if lecture is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="영상을 찾을 수 없습니다.")
    db.delete(lecture)
    db.commit()
    return OkResponse()


@router.get("/courses", response_model=list[CourseListItem])
def admin_list_courses(db: Session = Depends(get_db)) -> list[Course]:
    """어드민 전용: 비활성 강의도 포함, 심리상담 카테고리는 제외."""
    from app.models.course import CourseCategory as _CC
    return list(
        db.scalars(
            select(Course)
            .where(Course.category != _CC.COUNSELING)
            .order_by(Course.id)
        ).all()
    )


@router.get("/courses/{course_id}/quiz", response_model=QuizRead)
def get_quiz(course_id: int, db: Session = Depends(get_db)) -> QuizRead:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="강의를 찾을 수 없습니다.")

    quiz = db.scalar(
        select(Quiz)
        .where(Quiz.course_id == course_id)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
    )
    if quiz is None:
        return QuizRead(exists=False, questions=[])
    return QuizRead(exists=True, questions=quiz.questions)


@router.post("/courses/{course_id}/quiz", response_model=OkResponse)
def set_quiz(course_id: int, payload: QuizSet, db: Session = Depends(get_db)) -> OkResponse:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="강의를 찾을 수 없습니다.")

    # 정답 옵션이 정확히 하나인지 검증
    for q in payload.questions:
        correct = sum(1 for o in q.options if o.is_correct)
        if correct != 1:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"각 문항의 정답은 정확히 1개여야 합니다 (문제: {q.question_text[:30]}...).",
            )

    existing = db.scalar(select(Quiz).where(Quiz.course_id == course_id))
    if existing is not None:
        db.delete(existing)
        db.flush()

    quiz = Quiz(course_id=course_id)
    for idx, q in enumerate(payload.questions):
        question = QuizQuestion(question_text=q.question_text, order_index=idx)
        question.options = [
            QuizOption(option_text=o.option_text, is_correct=o.is_correct) for o in q.options
        ]
        quiz.questions.append(question)
    db.add(quiz)
    db.commit()
    return OkResponse()


# ---------- orders ------------------------------------------------------------


def _order_query_for_admin(db: Session, *, status_filter: OrderStatus | None):
    base = (
        select(Order, User, Course)
        .join(User, User.id == Order.user_id)
        .join(Course, Course.id == Order.course_id)
    )
    if status_filter is not None:
        base = base.where(Order.status == status_filter)
    return base


@router.get("/orders", response_model=AdminOrdersResponse)
def list_orders(
    status_filter: OrderStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
) -> AdminOrdersResponse:
    count_stmt = select(func.count(Order.id))
    if status_filter is not None:
        count_stmt = count_stmt.where(Order.status == status_filter)
    total = db.scalar(count_stmt) or 0

    rows = db.execute(
        _order_query_for_admin(db, status_filter=status_filter)
        .order_by(Order.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()

    items = [_row_from_order(o, u, c) for (o, u, c) in rows]
    return AdminOrdersResponse(items=items, total=total, page=page, size=size)


@router.post("/orders/{order_id}/cancel", response_model=OkResponse)
def cancel_order(order_id: int, db: Session = Depends(get_db)) -> OkResponse:
    """결제 전(PENDING) 주문 취소 — 예: 무통장 입금이 끝내 들어오지 않은 경우.

    아직 결제도 수강등록도 안 된 상태라 상태만 바꾸면 끝.
    """
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="주문을 찾을 수 없습니다.")
    if order.status != OrderStatus.PENDING:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="결제 대기 중인 주문만 취소할 수 있습니다."
        )
    order.status = OrderStatus.CANCELLED
    db.commit()
    return OkResponse()


def _revoke_issued_document(doc: IssuedDocument) -> None:
    """환불된 주문에 딸린 발급 서류 무효화 — DB 상태 변경 + 실제 PDF 파일 삭제.

    /static 은 인증 없이 공개 서빙되므로 상태만 바꾸고 파일을 안 지우면,
    이미 URL 을 알고 있는(저장해둔) 사람은 여전히 다운로드할 수 있다.
    document_type 별로 실제 저장 경로 규칙이 달라(수료증: PDF_DIR, 심리상담
    의견서: FINALS_DIR — 둘 다 파일명은 doc.access_token 그대로 사용) 타입을
    보고 분기한다.
    """
    if doc.access_token:
        if doc.document_type == IssuedDocumentType.CERTIFICATE:
            (PDF_DIR / f"cert_{doc.access_token}.pdf").unlink(missing_ok=True)
        elif doc.document_type == IssuedDocumentType.COUNSELING:
            (FINALS_DIR / f"{doc.access_token}.pdf").unlink(missing_ok=True)
    doc.status = IssuedDocumentStatus.REVOKED
    doc.access_token = None
    doc.pdf_url = None


@router.post("/orders/{order_id}/refund", response_model=OkResponse)
def refund_order(order_id: int, db: Session = Depends(get_db)) -> OkResponse:
    """결제 완료(PAID) 주문 환불 — 수강등록 취소 + 발급된 서류(있다면) 무효화까지 한 번에.

    법원 제출용 서류라 환불된 강의의 수료증/의견서가 계속 유효한 채로
    남아있으면 안 되므로, 이미 발급된 문서가 있으면 같이 무효화한다.
    """
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="주문을 찾을 수 없습니다.")
    if order.status != OrderStatus.PAID:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="결제 완료된 주문만 환불 처리할 수 있습니다."
        )

    # 묶음결제(여러 강의를 한 결제로 + 10만원 이상 할인)의 일부면, 하나의 Toss
    # 결제(paymentKey 공유)에 여러 Order row 가 걸려있는 것이므로 그 중 하나만
    # 환불하는 건 의미가 없다 — Toss 결제취소는 결제 1건 단위라 부분 취소가
    # 안 되고, 강의 하나만 DB 상 REFUNDED 로 바꿔봤자 실제 결제는 그대로다.
    # 같은 bundle_id 의 PAID 주문 전체를 함께 환불한다.
    bundle_orders = (
        list(
            db.scalars(
                select(Order).where(
                    Order.bundle_id == order.bundle_id,
                    Order.status == OrderStatus.PAID,
                )
            ).all()
        )
        if order.bundle_id
        else [order]
    )

    # 카드/간편결제(Toss) 로 결제된 건이면 Toss 결제취소 API를 먼저 호출해 실제로
    # 고객에게 돈이 돌아가게 한다. 이 호출 없이 DB 상태만 REFUNDED 로 바꾸면
    # 수강 권한/서류는 즉시 회수되는데 정작 결제된 돈은 그대로 남아있는 —
    # "환불 처리했다고 안내했는데 고객 카드에는 돈이 안 돌아온" 사고로 이어질
    # 수 있었다(2026-09 발견). 무통장입금은 애초에 Toss 를 거치지 않아
    # toss_payment_key 가 없으므로 자동화 대상이 아니고, 기존과 동일하게
    # 관리자가 계좌로 직접 환불해야 한다. TOSS_SECRET_KEY 미설정(로컬 개발)
    # 환경에서는 실 호출이 불가능하므로 기존처럼 DB 상태만 갱신한다.
    # 묶음결제는 모든 구성 주문이 같은 paymentKey 를 공유하므로 취소 호출은
    # 한 번만 하면 된다.
    if order.toss_payment_key and settings.TOSS_SECRET_KEY:
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(
                    f"{settings.TOSS_API_BASE}/v1/payments/{order.toss_payment_key}/cancel",
                    auth=(settings.TOSS_SECRET_KEY, ""),
                    json={"cancelReason": "관리자 환불 처리"},
                )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                detail=f"결제 게이트웨이 취소 호출에 실패했습니다: {exc!s}",
            ) from exc
        if res.status_code != 200:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"토스 결제 취소 실패: {res.text}",
            )

    for o in bundle_orders:
        o.status = OrderStatus.REFUNDED

        if o.order_type == OrderType.COURSE:
            enrollment = db.scalar(
                select(Enrollment).where(
                    Enrollment.user_id == o.user_id,
                    Enrollment.course_id == o.course_id,
                )
            )
            if enrollment is not None:
                db.delete(enrollment)

        docs = list(
            db.scalars(select(IssuedDocument).where(IssuedDocument.order_id == o.id)).all()
        )
        for doc in docs:
            _revoke_issued_document(doc)

    db.commit()
    return OkResponse()


# ---------- surveys -----------------------------------------------------------


@router.get("/surveys", response_model=list[AdminSurveyRow])
def list_surveys(db: Session = Depends(get_db)) -> list[AdminSurveyRow]:
    rows = db.execute(
        select(CounselingSurvey, User, Course, Order.order_type)
        .join(Order, Order.id == CounselingSurvey.order_id)
        .join(User, User.id == CounselingSurvey.user_id)
        .join(Course, Course.id == Order.course_id)
        .order_by(CounselingSurvey.submitted_at.desc())
    ).all()

    return [
        AdminSurveyRow(
            id=s.id,
            order_id=s.order_id,
            order_type=ot,
            username=u.username,
            course_title=c.title,
            status=s.status,
            submitted_at=s.submitted_at,
            draft_sent_at=s.draft_sent_at,
            completed_at=s.completed_at,
            ai_draft_url=s.ai_draft_url,
            final_pdf_url=s.final_pdf_url,
        )
        for (s, u, c, ot) in rows
    ]


@router.get("/surveys/{survey_id}", response_model=AdminSurveyDetail)
def get_survey_detail(survey_id: int, db: Session = Depends(get_db)) -> AdminSurveyDetail:
    survey = db.get(CounselingSurvey, survey_id)
    if survey is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="설문을 찾을 수 없습니다.")
    order = db.get(Order, survey.order_id)
    user = db.get(User, survey.user_id) if survey.user_id else None
    course = db.get(Course, order.course_id) if order else None
    from app.models.order import OrderType as _OT
    return AdminSurveyDetail(
        id=survey.id,
        order_id=survey.order_id,
        order_type=order.order_type if order else _OT.COURSE,
        username=user.username if user else "-",
        user_email=user.email if user else None,
        course_title=course.title if course else "-",
        status=survey.status,
        submitted_at=survey.submitted_at,
        draft_sent_at=survey.draft_sent_at,
        completed_at=survey.completed_at,
        ai_draft_url=survey.ai_draft_url,
        final_pdf_url=survey.final_pdf_url,
        responses=survey.responses or {},
    )


@router.post("/surveys/{survey_id}/upload-final", response_model=AdminSurveyRow)
async def upload_final(
    survey_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> AdminSurveyRow:
    survey = db.get(CounselingSurvey, survey_id)
    if survey is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="설문을 찾을 수 없습니다.")
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="PDF 파일만 업로드 가능합니다.",
        )

    # /static 은 인증 없이 공개 서빙되므로 파일명은 survey.id 가 아니라
    # 추측 불가능한 access_token 을 사용 (2026-09 발견·수정).
    token = survey.access_token or secrets.token_urlsafe(24)
    survey.access_token = token

    FINALS_DIR.mkdir(parents=True, exist_ok=True)
    target = FINALS_DIR / f"{token}.pdf"
    target.write_bytes(await file.read())

    pdf_url = f"/static/finals/{token}.pdf"
    survey.final_pdf_url = pdf_url
    survey.status = CounselingStatus.COMPLETED
    survey.completed_at = _now()

    # IssuedDocument 레코드 생성 (counseling 타입 — 별도 issue_number 발급)
    issue_number = (
        f"KCPEC-CNSL-{datetime.now(timezone.utc).strftime('%Y%m%d')}-"
        f"{secrets.token_hex(3).upper()}"
    )
    order = db.get(Order, survey.order_id)
    user = db.get(User, survey.user_id) if survey.user_id else None
    if order is not None and user is not None:
        doc = IssuedDocument(
            order_id=order.id,
            user_id=user.id,
            document_type=IssuedDocumentType.COUNSELING,
            recipient_name=user.username,
            recipient_birth=user.birth_date or datetime(2000, 1, 1).date(),
            pdf_url=pdf_url,
            issue_number=issue_number,
            access_token=token,
            status=IssuedDocumentStatus.READY,
            issued_at=_now(),
        )
        db.add(doc)

    db.commit()
    db.refresh(survey)

    if user is not None:
        background_tasks.add_task(
            send_final_to_user,
            to_email=user.email,
            recipient_name=user.username,
            pdf_url=pdf_url,
        )

    course = db.get(Course, order.course_id) if order else None
    from app.models.order import OrderType as _OT
    return AdminSurveyRow(
        id=survey.id,
        order_id=survey.order_id,
        order_type=order.order_type if order else _OT.COURSE,
        username=user.username if user else "-",
        course_title=course.title if course else "-",
        status=survey.status,
        submitted_at=survey.submitted_at,
        draft_sent_at=survey.draft_sent_at,
        completed_at=survey.completed_at,
        ai_draft_url=survey.ai_draft_url,
        final_pdf_url=survey.final_pdf_url,
    )


# ---------- 의견서 양식 자동 채우기 (DOCX/PDF 다운로드) ----------------------


class ExportRequest(BaseModel):
    draft_text: str = Field(min_length=1)
    format: Literal["docx", "pdf"]


def _safe_filename_part(s: str) -> str:
    """Content-Disposition 값에 들어가도 안전한 ASCII filename fallback 용 정규화."""
    return "".join(c if c.isalnum() else "_" for c in s) or "survey"


@router.post("/surveys/{survey_id}/export")
def export_counseling_doc(
    survey_id: int,
    payload: ExportRequest,
    db: Session = Depends(get_db),
):
    survey = db.get(CounselingSurvey, survey_id)
    if survey is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="설문을 찾을 수 없습니다.")
    user = db.get(User, survey.user_id) if survey.user_id else None
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="설문 작성자를 찾을 수 없습니다.")

    # exports 도 /static 하위(공개 서빙)라 survey.id 대신 토큰 기반 파일명 사용.
    token = survey.access_token or secrets.token_urlsafe(24)
    if survey.access_token != token:
        survey.access_token = token
        db.commit()

    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    docx_path = EXPORTS_DIR / f"counseling_{token}.docx"

    try:
        fill_counseling_template(survey, user, payload.draft_text, docx_path)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"양식 채우기 실패: {e}",
        )

    name_part = _safe_filename_part(user.username)
    date_part = datetime.now().strftime("%Y%m%d")

    if payload.format == "pdf":
        try:
            pdf_path = convert_office_to_pdf(docx_path, EXPORTS_DIR)
        except Exception as e:  # noqa: BLE001
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"PDF 변환 실패: {e}",
            )
        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            filename=f"심리상담_의견서_{name_part}_{date_part}.pdf",
        )

    return FileResponse(
        docx_path,
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        ),
        filename=f"심리상담_의견서_{name_part}_{date_part}.docx",
    )


# ---------- 의견서 초안 LLM 재생성 -------------------------------------------


class RegenerateDraftRequest(BaseModel):
    # 추가 지시사항 (선택). 비어 있으면 기본 프롬프트만으로 재생성.
    extra_instructions: str = ""


class RegenerateDraftResponse(BaseModel):
    draft_text: str
    draft_url: str
    # 더미 텍스트(GEMINI_API_KEY 미설정뿐 아니라 키가 유효하지 않거나 API 호출이
    # 실패한 경우도 포함)인지 — draft_text 자체로 판단(is_dummy_draft). 설정값만
    # 보면 "키는 있는데 무효/실패"인 실제 장애 상황을 놓친다. 더미 문구가 본문에
    # 섞여 있어도 관리자가 훑어보다 놓칠 수 있어서, 프론트가 눈에 띄는 경고
    # 배너를 띄울 수 있도록 별도 플래그로 노출한다.
    is_dummy: bool


@router.post(
    "/surveys/{survey_id}/regenerate-draft",
    response_model=RegenerateDraftResponse,
)
def regenerate_draft(
    survey_id: int,
    payload: RegenerateDraftRequest,
    db: Session = Depends(get_db),
) -> RegenerateDraftResponse:
    survey = db.get(CounselingSurvey, survey_id)
    if survey is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="설문을 찾을 수 없습니다."
        )

    order = db.get(Order, survey.order_id)
    course = db.get(Course, order.course_id) if order else None
    course_title = course.title if course else "(강의 정보 없음)"

    try:
        draft = generate_counseling_draft(
            survey.responses,
            course_title,
            extra_instructions=payload.extra_instructions,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"초안 재생성 실패: {e}",
        )

    token = survey.access_token or secrets.token_urlsafe(24)
    survey.access_token = token

    DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
    draft_path = DRAFTS_DIR / f"{token}.txt"
    draft_path.write_text(draft, encoding="utf-8")

    draft_url = f"/static/drafts/{token}.txt"
    survey.ai_draft_url = draft_url
    # 상태가 SUBMITTED 였다면 DRAFT_GENERATED 로 끌어올림 (이미 더 진행된 상태면 유지).
    if survey.status == CounselingStatus.SUBMITTED:
        survey.status = CounselingStatus.DRAFT_GENERATED
    db.commit()

    return RegenerateDraftResponse(
        draft_text=draft, draft_url=draft_url, is_dummy=is_dummy_draft(draft)
    )


# ---------- stats -------------------------------------------------------------


@router.get("/stats", response_model=AdminStats)
def admin_stats(db: Session = Depends(get_db)) -> AdminStats:
    today_start = datetime.combine(_now().date(), time.min, tzinfo=timezone.utc)
    yesterday_start = today_start - timedelta(days=1)

    total_users = db.scalar(select(func.count(User.id))) or 0
    total_enrollments = db.scalar(select(func.count(Enrollment.id))) or 0
    total_orders_paid = (
        db.scalar(select(func.count(Order.id)).where(Order.status == OrderStatus.PAID)) or 0
    )
    total_revenue = (
        db.scalar(
            select(func.coalesce(func.sum(Order.amount), 0)).where(
                Order.status == OrderStatus.PAID
            )
        )
        or 0
    )
    today_signups = (
        db.scalar(select(func.count(User.id)).where(User.created_at >= today_start)) or 0
    )
    today_paid_orders = (
        db.scalar(
            select(func.count(Order.id)).where(
                Order.status == OrderStatus.PAID,
                Order.paid_at >= today_start,
            )
        )
        or 0
    )
    today_revenue = (
        db.scalar(
            select(func.coalesce(func.sum(Order.amount), 0)).where(
                Order.status == OrderStatus.PAID,
                Order.paid_at >= today_start,
            )
        )
        or 0
    )
    yesterday_new_users = (
        db.scalar(
            select(func.count(User.id)).where(
                User.created_at >= yesterday_start,
                User.created_at < today_start,
            )
        )
        or 0
    )
    yesterday_orders = (
        db.scalar(
            select(func.count(Order.id)).where(
                Order.status == OrderStatus.PAID,
                Order.paid_at >= yesterday_start,
                Order.paid_at < today_start,
            )
        )
        or 0
    )
    yesterday_revenue = (
        db.scalar(
            select(func.coalesce(func.sum(Order.amount), 0)).where(
                Order.status == OrderStatus.PAID,
                Order.paid_at >= yesterday_start,
                Order.paid_at < today_start,
            )
        )
        or 0
    )
    month_start = datetime.combine(
        _now().date().replace(day=1), time.min, tzinfo=timezone.utc
    )
    month_revenue = (
        db.scalar(
            select(func.coalesce(func.sum(Order.amount), 0)).where(
                Order.status == OrderStatus.PAID,
                Order.paid_at >= month_start,
            )
        )
        or 0
    )

    recent_rows = db.execute(
        _order_query_for_admin(db, status_filter=None)
        .order_by(Order.created_at.desc())
        .limit(5)
    ).all()
    recent = [_row_from_order(o, u, c) for (o, u, c) in recent_rows]

    # 인기 강의 top 5 (paid 매출 기준)
    top_rows = db.execute(
        select(Course.title, func.coalesce(func.sum(Order.amount), 0))
        .join(Course, Course.id == Order.course_id)
        .where(Order.status == OrderStatus.PAID)
        .group_by(Course.title)
        .order_by(func.coalesce(func.sum(Order.amount), 0).desc())
        .limit(5)
    ).all()
    top_courses: list[AdminTopCourse] = [
        AdminTopCourse(
            course_title=ct,
            revenue=int(rev),
            percentage=(round(int(rev) * 100 / total_revenue, 1) if total_revenue else 0.0),
        )
        for (ct, rev) in top_rows
    ]

    # 최근 가입 회원 (admin 제외, 더미가 아니어도 그대로 노출)
    recent_user_rows = list(
        db.scalars(
            select(User)
            .where(User.is_admin.is_(False))
            .order_by(User.created_at.desc())
            .limit(4)
        ).all()
    )
    recent_users = [
        AdminUserBrief(id=u.id, name=u.username, email=u.email, created_at=u.created_at)
        for u in recent_user_rows
    ]

    # 최근 활동 로그 (paid 결제 / 강의 수료 / Q&A 등록 union)
    activities: list[AdminActivity] = []
    # 1) 결제
    paid_acts = db.execute(
        select(Order, User, Course)
        .join(User, User.id == Order.user_id)
        .join(Course, Course.id == Order.course_id)
        .where(Order.status == OrderStatus.PAID, Order.paid_at.is_not(None))
        .order_by(Order.paid_at.desc())
        .limit(5)
    ).all()
    for o, u, c in paid_acts:
        activities.append(
            AdminActivity(
                type="order_paid",
                message=f"{u.username}님이 {c.title} 결제 완료",
                created_at=o.paid_at or o.created_at,
            )
        )
    # 2) 수료
    completed_acts = db.execute(
        select(Enrollment, User, Course)
        .join(User, User.id == Enrollment.user_id)
        .join(Course, Course.id == Enrollment.course_id)
        .where(Enrollment.is_completed.is_(True), Enrollment.completed_at.is_not(None))
        .order_by(Enrollment.completed_at.desc())
        .limit(5)
    ).all()
    for e, u, c in completed_acts:
        activities.append(
            AdminActivity(
                type="course_completed",
                message=f"{u.username}님이 {c.title} 수료",
                created_at=e.completed_at or _now(),
            )
        )
    # 3) Q&A
    from app.models.community import PostCategory as _PC  # local import 로 의존 최소화
    qna_acts = list(
        db.scalars(
            select(Post)
            .where(Post.category == _PC.QNA)
            .order_by(Post.created_at.desc())
            .limit(5)
        ).all()
    )
    for p in qna_acts:
        activities.append(
            AdminActivity(
                type="qna_posted",
                message=f"{p.author_name}님이 Q&A 문의 등록",
                created_at=p.created_at,
            )
        )
    activities.sort(key=lambda a: a.created_at, reverse=True)
    recent_activities = activities[:5]

    return AdminStats(
        total_users=total_users,
        total_enrollments=total_enrollments,
        total_orders_paid=total_orders_paid,
        total_revenue=total_revenue,
        today_signups=today_signups,
        today_paid_orders=today_paid_orders,
        today_revenue=today_revenue,
        yesterday_new_users=yesterday_new_users,
        yesterday_orders=yesterday_orders,
        yesterday_revenue=yesterday_revenue,
        month_revenue=month_revenue,
        recent_orders=recent,
        top_courses=top_courses,
        recent_users=recent_users,
        recent_activities=recent_activities,
    )


@router.get("/statistics/sales", response_model=SalesStats)
def admin_sales_stats(db: Session = Depends(get_db)) -> SalesStats:
    """매출 통계 — 이번달/전월/일별 30일/상품별/결제수단별 집계.

    paid 상태 주문만 대상으로 함. paid_at 이 비어있는 데이터는 제외.
    """
    now = _now()
    today = now.date()
    this_month_start = datetime.combine(today.replace(day=1), time.min, tzinfo=timezone.utc)
    last_month_end = this_month_start  # 전월 마지막 분 + 1
    # 전월 1일
    if today.month == 1:
        last_month_start = datetime(today.year - 1, 12, 1, tzinfo=timezone.utc)
    else:
        last_month_start = datetime(today.year, today.month - 1, 1, tzinfo=timezone.utc)
    # 30일 전
    thirty_days_ago = datetime.combine(today, time.min, tzinfo=timezone.utc) - timedelta(days=29)

    base = select(Order).where(Order.status == OrderStatus.PAID, Order.paid_at.is_not(None))

    # 이번달 / 전월 합계
    this_month_revenue = (
        db.scalar(
            select(func.coalesce(func.sum(Order.amount), 0)).where(
                Order.status == OrderStatus.PAID,
                Order.paid_at >= this_month_start,
            )
        )
        or 0
    )
    this_month_orders = (
        db.scalar(
            select(func.count(Order.id)).where(
                Order.status == OrderStatus.PAID,
                Order.paid_at >= this_month_start,
            )
        )
        or 0
    )
    last_month_revenue = (
        db.scalar(
            select(func.coalesce(func.sum(Order.amount), 0)).where(
                Order.status == OrderStatus.PAID,
                Order.paid_at >= last_month_start,
                Order.paid_at < last_month_end,
            )
        )
        or 0
    )
    avg_order_amount = (
        int(round(this_month_revenue / this_month_orders)) if this_month_orders > 0 else 0
    )

    # 일별 매출 (최근 30일) — DB 에서 Python 으로 집계 (DB 호환성 단순화)
    rows = db.execute(
        select(Order.paid_at, Order.amount).where(
            Order.status == OrderStatus.PAID,
            Order.paid_at.is_not(None),
            Order.paid_at >= thirty_days_ago,
        )
    ).all()
    daily: dict[str, dict[str, int]] = {}
    for paid_at, amount in rows:
        key = paid_at.date().isoformat()
        bucket = daily.setdefault(key, {"revenue": 0, "orders": 0})
        bucket["revenue"] += amount
        bucket["orders"] += 1
    daily_revenue: list[SalesStatsDaily] = []
    for i in range(30):
        d = (thirty_days_ago + timedelta(days=i)).date().isoformat()
        b = daily.get(d, {"revenue": 0, "orders": 0})
        daily_revenue.append(SalesStatsDaily(date=d, revenue=b["revenue"], orders=b["orders"]))

    # 상품(강의) 별
    by_course_rows = db.execute(
        select(
            Course.title,
            func.count(Order.id),
            func.coalesce(func.sum(Order.amount), 0),
        )
        .join(Course, Course.id == Order.course_id)
        .where(Order.status == OrderStatus.PAID)
        .group_by(Course.title)
        .order_by(func.coalesce(func.sum(Order.amount), 0).desc())
    ).all()
    by_course = [
        SalesStatsByCourse(course_title=ct, count=cnt, revenue=rev)
        for (ct, cnt, rev) in by_course_rows
    ]

    # 결제수단 별
    by_payment_rows = db.execute(
        select(
            Order.payment_method,
            func.count(Order.id),
            func.coalesce(func.sum(Order.amount), 0),
        )
        .where(Order.status == OrderStatus.PAID)
        .group_by(Order.payment_method)
        .order_by(func.count(Order.id).desc())
    ).all()
    by_payment = [
        SalesStatsByPayment(method=method, count=cnt, revenue=rev)
        for (method, cnt, rev) in by_payment_rows
    ]

    # 사용 안 하는 변수 — base 는 단순 hint 용
    _ = base
    return SalesStats(
        this_month_revenue=this_month_revenue,
        this_month_orders=this_month_orders,
        last_month_revenue=last_month_revenue,
        avg_order_amount=avg_order_amount,
        daily_revenue=daily_revenue,
        by_course=by_course,
        by_payment=by_payment,
    )


@router.get("/statistics/visitors", response_model=VisitorStats)
def admin_visitor_stats(db: Session = Depends(get_db)) -> VisitorStats:
    """방문자 통계 — GA4 연동 전 DB 기반 근사 지표.

    - 신규 가입자 (이번달 / 전월)
    - 누적 수강 신청
    - 이번달 전환율 = 이번달 신규 가입자 중 결제까지 이어진 사용자 비율
      (예전엔 "이번달 결제건수 / 이번달 신규가입" 이었는데, 분자가 신규가입자로
      한정되지 않아 기존 회원 결제까지 다 섞이고 한 명이 여러 번 결제하면
      100% 를 넘어버리는 등 숫자가 의미를 안 갖는 문제가 있었음. 지금은 "이번달
      가입자" 코호트 안에서만 전환 여부(0/1)를 세므로 0~100% 로 항상 유효함.)
    - 활성 사용자 1인당 평균 수강 신청 수
    """
    now = _now()
    today = now.date()
    this_month_start = datetime.combine(today.replace(day=1), time.min, tzinfo=timezone.utc)
    if today.month == 1:
        last_month_start = datetime(today.year - 1, 12, 1, tzinfo=timezone.utc)
    else:
        last_month_start = datetime(today.year, today.month - 1, 1, tzinfo=timezone.utc)

    new_users_this_month = (
        db.scalar(
            select(func.count(User.id)).where(User.created_at >= this_month_start)
        )
        or 0
    )
    new_users_last_month = (
        db.scalar(
            select(func.count(User.id)).where(
                User.created_at >= last_month_start,
                User.created_at < this_month_start,
            )
        )
        or 0
    )
    total_enrollments = db.scalar(select(func.count(Enrollment.id))) or 0

    # 이번달 가입자 중 결제(PAID) 이력이 하나라도 있는 사용자 수 — 사용자
    # 단위로 distinct 를 세기 때문에 한 명이 여러 번 결제해도 1명으로만
    # 잡히고, 분자가 항상 분모(이번달 신규가입)의 부분집합이라 0~100% 를 벗어날 수 없다.
    converted_new_users_this_month = (
        db.scalar(
            select(func.count(func.distinct(Order.user_id))).where(
                Order.status == OrderStatus.PAID,
                Order.user_id.in_(
                    select(User.id).where(User.created_at >= this_month_start)
                ),
            )
        )
        or 0
    )
    conversion_rate = (
        round((converted_new_users_this_month / new_users_this_month) * 100, 1)
        if new_users_this_month > 0
        else 0.0
    )

    # 평균 수강 신청 수 — enrollments 가 있는 사용자만 분모 (활성)
    distinct_enrolled_users = (
        db.scalar(select(func.count(func.distinct(Enrollment.user_id)))) or 0
    )
    avg_courses_per_user = (
        round(total_enrollments / distinct_enrolled_users, 1)
        if distinct_enrolled_users > 0
        else 0.0
    )

    return VisitorStats(
        new_users_this_month=new_users_this_month,
        new_users_last_month=new_users_last_month,
        total_enrollments=total_enrollments,
        conversion_rate=conversion_rate,
        avg_courses_per_user=avg_courses_per_user,
    )


# ---------- new admin endpoints ----------------------------------------------


@router.get("/courses/enrollment-counts", response_model=list[CourseEnrollmentCount])
def courses_enrollment_counts(db: Session = Depends(get_db)) -> list[CourseEnrollmentCount]:
    rows = db.execute(
        select(Course.id, Course.title, Course.category, func.count(Enrollment.id))
        .outerjoin(Enrollment, Enrollment.course_id == Course.id)
        .group_by(Course.id)
        .order_by(Course.id)
    ).all()
    return [
        CourseEnrollmentCount(
            course_id=cid, course_title=title, category=cat, enrollment_count=cnt
        )
        for (cid, title, cat, cnt) in rows
    ]


@router.get("/orders/{order_id}/documents", response_model=list[DocumentResponse])
def admin_order_documents(order_id: int, db: Session = Depends(get_db)) -> list[DocumentResponse]:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="주문을 찾을 수 없습니다.")
    docs = list(
        db.scalars(
            select(IssuedDocument)
            .where(IssuedDocument.order_id == order_id)
            .order_by(IssuedDocument.id.desc())
        ).all()
    )
    return [DocumentResponse.model_validate(d) for d in docs]


@router.patch("/notices/{notice_id}", response_model=NoticeDetail)
def patch_notice(notice_id: int, payload: NoticePatch, db: Session = Depends(get_db)) -> NoticeDetail:
    notice = db.get(Notice, notice_id)
    if notice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="공지를 찾을 수 없습니다.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(notice, field, value)
    db.commit()
    db.refresh(notice)
    return NoticeDetail.model_validate(notice)


@router.delete("/notices/{notice_id}", response_model=OkResponse)
def delete_notice(notice_id: int, db: Session = Depends(get_db)) -> OkResponse:
    notice = db.get(Notice, notice_id)
    if notice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="공지를 찾을 수 없습니다.")
    db.delete(notice)
    db.commit()
    return OkResponse()


@router.patch("/posts/{post_id}", response_model=PostDetail)
def patch_post(post_id: int, payload: PostPatch, db: Session = Depends(get_db)) -> PostDetail:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="게시글을 찾을 수 없습니다.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(post, field, value)
    db.commit()
    db.refresh(post)
    return PostDetail.model_validate(post)


@router.delete("/posts/{post_id}", response_model=OkResponse)
def delete_post(post_id: int, db: Session = Depends(get_db)) -> OkResponse:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="게시글을 찾을 수 없습니다.")
    db.delete(post)
    db.commit()
    return OkResponse()


@router.patch("/posts/{post_id}/reply", response_model=PostDetail)
def patch_post_reply(
    post_id: int, payload: PostAdminReply, db: Session = Depends(get_db)
) -> PostDetail:
    """관리자 답변 등록/수정. Q&A 카테고리에만 의미 있음."""
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="게시글을 찾을 수 없습니다.")
    post.admin_reply = payload.reply.strip()
    db.commit()
    db.refresh(post)
    return PostDetail.model_validate(post)


# ---------- faq (자주 묻는 질문) -----------------------------------------------


@router.get("/faq", response_model=list[FaqRead])
def admin_list_faqs(db: Session = Depends(get_db)) -> list[Faq]:
    """공개용 /faq 와 달리 비활성 항목까지 전부 반환 (관리자 목록용)."""
    return list(db.scalars(select(Faq).order_by(Faq.order_index, Faq.id)).all())


@router.post("/faq", response_model=FaqRead, status_code=status.HTTP_201_CREATED)
def create_faq(payload: FaqCreate, db: Session = Depends(get_db)) -> Faq:
    faq = Faq(**payload.model_dump())
    db.add(faq)
    db.commit()
    db.refresh(faq)
    return faq


@router.patch("/faq/{faq_id}", response_model=FaqRead)
def patch_faq(faq_id: int, payload: FaqPatch, db: Session = Depends(get_db)) -> Faq:
    faq = db.get(Faq, faq_id)
    if faq is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="FAQ를 찾을 수 없습니다.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(faq, field, value)
    db.commit()
    db.refresh(faq)
    return faq


@router.delete("/faq/{faq_id}", response_model=OkResponse)
def delete_faq(faq_id: int, db: Session = Depends(get_db)) -> OkResponse:
    faq = db.get(Faq, faq_id)
    if faq is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="FAQ를 찾을 수 없습니다.")
    db.delete(faq)
    db.commit()
    return OkResponse()


# ---------- 시스템 상태 점검 ---------------------------------------------------


@router.get("/health", response_model=HealthResponse)
def system_health(db: Session = Depends(get_db)) -> HealthResponse:
    """배포 직후 조용히 깨져있기 쉬운 서버 의존성 점검 (DB/LibreOffice/한글폰트/
    수료증 템플릿/S3/SMTP/Gemini/토스). 2026-09 EC2 첫 배포 때 이 중 여러 개가
    실제로 깨져있었는데 실사용자가 수료증을 발급받으려다가 처음 발견했음 —
    배포 직후 이 화면 하나만 확인하면 바로 알 수 있게 하기 위함.
    """
    items = run_all_checks(db)
    return HealthResponse(
        all_ok=all(item.ok for item in items),
        checked_at=datetime.now(timezone.utc),
        items=items,
    )
