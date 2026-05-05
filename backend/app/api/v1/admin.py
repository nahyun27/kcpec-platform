from datetime import datetime, time, timezone
from pathlib import Path

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
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.admin import require_admin
from app.core.database import get_db
from app.core.email import send_final_to_user
from app.models.community import Notice, Post
from app.models.counseling import CounselingStatus, CounselingSurvey
from app.models.course import Course
from app.models.document import IssuedDocument, IssuedDocumentStatus, IssuedDocumentType
from app.models.enrollment import Enrollment
from app.models.lecture import Lecture
from app.models.order import Order, OrderStatus, PaymentMethod
from app.models.package import Package
from app.models.quiz import Quiz, QuizOption, QuizQuestion
from app.models.user import User
from app.schemas.admin import (
    AdminOrderRow,
    AdminOrdersResponse,
    AdminStats,
    AdminSurveyDetail,
    AdminSurveyRow,
    AdminUser,
    AdminUsersResponse,
    CourseCreate,
    CourseEnrollmentCount,
    CoursePatch,
    LectureCreate,
    NoticePatch,
    OkResponse,
    PostPatch,
    QuizSet,
)
from app.schemas.community import NoticeDetail, PostDetail
from app.schemas.course import CourseDetail, CourseListItem, LectureItem
from app.schemas.document import DocumentResponse
from app.schemas.order import OrderResponse

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

FINALS_DIR = Path(__file__).resolve().parents[3] / "static" / "finals"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _row_from_order(o: Order, user: User, course: Course, package: Package) -> AdminOrderRow:
    return AdminOrderRow(
        id=o.id,
        user_id=user.id,
        username=user.username,
        email=user.email,
        course_title=course.title,
        package_name=package.name,
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
    db: Session = Depends(get_db),
) -> AdminUsersResponse:
    total = db.scalar(select(func.count(User.id))) or 0
    items = list(
        db.scalars(
            select(User)
            .order_by(User.id.desc())
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


# ---------- courses -----------------------------------------------------------


@router.post("/courses", response_model=CourseListItem, status_code=status.HTTP_201_CREATED)
def create_course(payload: CourseCreate, db: Session = Depends(get_db)) -> Course:
    course = Course(
        title=payload.title,
        description=payload.description,
        category=payload.category,
        price=payload.price,
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
    db.commit()
    db.refresh(course)
    return CourseDetail(
        id=course.id,
        title=course.title,
        category=course.category,
        thumbnail_url=course.thumbnail_url,
        price=course.price,
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
    lecture = Lecture(
        course_id=course.id,
        title=payload.title,
        order_index=payload.order_index,
        video_url=payload.video_url,
        duration_seconds=payload.duration_seconds,
        is_active=True,
    )
    db.add(lecture)
    db.commit()
    db.refresh(lecture)
    return lecture


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
        select(Order, User, Course, Package)
        .join(User, User.id == Order.user_id)
        .join(Course, Course.id == Order.course_id)
        .join(Package, Package.id == Order.package_id)
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

    items = [_row_from_order(o, u, c, p) for (o, u, c, p) in rows]
    return AdminOrdersResponse(items=items, total=total, page=page, size=size)


@router.post("/orders/bank/confirm/{order_id}", response_model=OrderResponse)
def confirm_bank_order(order_id: int, db: Session = Depends(get_db)) -> Order:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="주문을 찾을 수 없습니다.")
    if order.payment_method != PaymentMethod.BANK_TRANSFER:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="무통장 주문이 아닙니다.")
    if order.status == OrderStatus.PAID:
        return order
    order.status = OrderStatus.PAID
    order.paid_at = _now()
    order.bank_confirmed_at = _now()
    db.commit()
    db.refresh(order)
    return order


# ---------- surveys -----------------------------------------------------------


@router.get("/surveys", response_model=list[AdminSurveyRow])
def list_surveys(db: Session = Depends(get_db)) -> list[AdminSurveyRow]:
    rows = db.execute(
        select(CounselingSurvey, User, Course)
        .join(Order, Order.id == CounselingSurvey.order_id)
        .join(User, User.id == CounselingSurvey.user_id)
        .join(Course, Course.id == Order.course_id)
        .order_by(CounselingSurvey.submitted_at.desc())
    ).all()

    return [
        AdminSurveyRow(
            id=s.id,
            order_id=s.order_id,
            username=u.username,
            course_title=c.title,
            status=s.status,
            submitted_at=s.submitted_at,
            draft_sent_at=s.draft_sent_at,
            completed_at=s.completed_at,
            ai_draft_url=s.ai_draft_url,
            final_pdf_url=s.final_pdf_url,
        )
        for (s, u, c) in rows
    ]


@router.get("/surveys/{survey_id}", response_model=AdminSurveyDetail)
def get_survey_detail(survey_id: int, db: Session = Depends(get_db)) -> AdminSurveyDetail:
    survey = db.get(CounselingSurvey, survey_id)
    if survey is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="설문을 찾을 수 없습니다.")
    order = db.get(Order, survey.order_id)
    user = db.get(User, survey.user_id) if survey.user_id else None
    course = db.get(Course, order.course_id) if order else None
    return AdminSurveyDetail(
        id=survey.id,
        order_id=survey.order_id,
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

    FINALS_DIR.mkdir(parents=True, exist_ok=True)
    target = FINALS_DIR / f"{survey.id}.pdf"
    target.write_bytes(await file.read())

    pdf_url = f"/static/finals/{survey.id}.pdf"
    survey.final_pdf_url = pdf_url
    survey.status = CounselingStatus.COMPLETED
    survey.completed_at = _now()

    # IssuedDocument 레코드 생성 (counseling 타입 — 별도 issue_number 발급)
    import secrets
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
    return AdminSurveyRow(
        id=survey.id,
        order_id=survey.order_id,
        username=user.username if user else "-",
        course_title=course.title if course else "-",
        status=survey.status,
        submitted_at=survey.submitted_at,
        draft_sent_at=survey.draft_sent_at,
        completed_at=survey.completed_at,
        ai_draft_url=survey.ai_draft_url,
        final_pdf_url=survey.final_pdf_url,
    )


# ---------- stats -------------------------------------------------------------


@router.get("/stats", response_model=AdminStats)
def admin_stats(db: Session = Depends(get_db)) -> AdminStats:
    today_start = datetime.combine(_now().date(), time.min, tzinfo=timezone.utc)

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
    recent = [_row_from_order(o, u, c, p) for (o, u, c, p) in recent_rows]

    return AdminStats(
        total_users=total_users,
        total_enrollments=total_enrollments,
        total_orders_paid=total_orders_paid,
        total_revenue=total_revenue,
        today_signups=today_signups,
        today_paid_orders=today_paid_orders,
        today_revenue=today_revenue,
        month_revenue=month_revenue,
        recent_orders=recent,
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
