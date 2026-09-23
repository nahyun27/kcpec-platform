"""전문가 심리상담 독립 구매 흐름.

상담 프로그램 자체는 Course 테이블에 category=COUNSELING 으로 저장.
주문은 order_type=COUNSELING 로 만들어진다.
"""

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.counseling import _process_draft
from app.api.v1.orders import _cancel_stale_pending, get_or_create_letter_course
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.counseling import CounselingStatus, CounselingSurvey
from app.models.course import Course, CourseCategory
from app.models.legal_letter import LegalLetterType
from app.models.order import Order, OrderStatus, OrderType, PaymentMethod
from app.models.user import User
from app.schemas.counseling import (
    SurveyDetailResponse,
    SurveyUpdate,
)
from app.schemas.counseling_purchase import (
    CounselingOrderItem,
    CounselingPurchaseRequest,
    CounselingPurchaseResponse,
    CounselingType,
    LegalLetterOrderRef,
)

router = APIRouter(prefix="/counseling", tags=["counseling-purchase"])

# counseling_type → Course.title 매핑 (seed 와 동일하게 유지)
TITLE_BY_TYPE: dict[CounselingType, str] = {
    "basic": "기본 프로그램",
    "phone": "전화 심화상담",
    "inperson": "대면 심화상담",
}


def _resolve_course(db: Session, ctype: CounselingType) -> Course:
    title = TITLE_BY_TYPE[ctype]
    course = db.scalar(
        select(Course).where(
            Course.category == CourseCategory.COUNSELING, Course.title == title
        )
    )
    if course is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail=f"심리상담 상품을 찾을 수 없습니다: {title}",
        )
    return course


def _type_for_course(course: Course) -> CounselingType:
    for ctype, title in TITLE_BY_TYPE.items():
        if course.title == title:
            return ctype
    # 매핑 못 찾는 경우 안전한 기본값.
    return "basic"


@router.post(
    "/purchase",
    response_model=CounselingPurchaseResponse,
    status_code=status.HTTP_201_CREATED,
)
def purchase(
    payload: CounselingPurchaseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CounselingPurchaseResponse:
    _cancel_stale_pending(db, current_user.id)

    course = _resolve_course(db, payload.counseling_type)

    # 가격이 매겨진 상품만 즉시 결제 흐름 — price 가 없거나 0인 상품(예: 대면
    # 심화상담)은 별도 문의로 남는다. type 을 하드코딩하지 않고 price 로만 판단.
    requires_payment = (course.price or 0) > 0
    amount = course.price or 0

    # (검토 후 의도적으로 미적용) orders.py는 카드/토스 결제에 대해 중복
    # PENDING 주문을 일부러 막지 않는다 — 사용자가 체크아웃 도중 이탈/재시도
    # 하는 게 흔한데, 자가 취소 수단이 없는 상태에서 막으면 재구매 자체가
    # 막혀버리기 때문(orders.py 주석 참고). 이 엔드포인트도 항상
    # PaymentMethod.CARD 를 쓰므로 같은 이유로 중복 PENDING 차단을 넣지 않는다.
    #
    # 반성문·탄원서를 함께 선택한 경우에만 묶음결제(bundle_id 공유)로 만든다
    # — 선택하지 않으면 예전과 완전히 동일한 단건 주문 흐름(하위호환).
    letter_types = list(dict.fromkeys(payload.legal_letters))  # 중복 제거, 순서 유지
    bundle_id = secrets.token_urlsafe(16) if letter_types else None

    order = Order(
        user_id=current_user.id,
        course_id=course.id,
        order_type=OrderType.COUNSELING,
        payment_method=PaymentMethod.CARD,
        amount=amount,
        status=OrderStatus.PENDING,
        bundle_id=bundle_id,
    )
    db.add(order)
    db.flush()

    letter_refs: list[LegalLetterOrderRef] = []
    for lt in letter_types:
        letter_type = LegalLetterType(lt)
        letter_course = get_or_create_letter_course(db, letter_type)
        letter_price = letter_course.price or 0
        letter_order = Order(
            user_id=current_user.id,
            course_id=letter_course.id,
            order_type=OrderType.COURSE,
            payment_method=PaymentMethod.CARD,
            amount=letter_price,
            status=OrderStatus.PENDING,
            bundle_id=bundle_id,
        )
        db.add(letter_order)
        db.flush()
        letter_refs.append(
            LegalLetterOrderRef(order_id=letter_order.id, letter_type=lt, amount=letter_price)
        )
        amount += letter_price

    db.commit()
    db.refresh(order)

    return CounselingPurchaseResponse(
        order_id=order.id,
        course_id=course.id,
        amount=amount,
        status=order.status,
        payment_method=order.payment_method,
        requires_payment=requires_payment,
        counseling_type=payload.counseling_type,
        bundle_id=bundle_id,
        legal_letter_orders=letter_refs,
    )


@router.get("/my-orders", response_model=list[CounselingOrderItem])
def my_counseling_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CounselingOrderItem]:
    rows = db.execute(
        select(Order, Course)
        .join(Course, Course.id == Order.course_id)
        .where(
            Order.user_id == current_user.id,
            Order.order_type == OrderType.COUNSELING,
            # 결제를 시작만 하고 완료하지 않은(PENDING) 주문이나 취소된
            # 주문까지 여기 뜨면 "전문가 심리상담" 탭에 실제로 신청하지도
            # 않은 상담이 나타나 보인다 — 결제내역 탭과 달리 이 탭은 "실제로
            # 진행 중/완료된 상담"만 보여주는 게 맞다(2026-09 발견).
            Order.status == OrderStatus.PAID,
        )
        .order_by(Order.created_at.desc())
    ).all()
    if not rows:
        return []

    order_ids = [o.id for (o, _c) in rows]
    surveys = {
        s.order_id: s
        for s in db.scalars(
            select(CounselingSurvey).where(CounselingSurvey.order_id.in_(order_ids))
        ).all()
    }

    out: list[CounselingOrderItem] = []
    for order, course in rows:
        survey = surveys.get(order.id)
        out.append(
            CounselingOrderItem(
                order_id=order.id,
                counseling_type=_type_for_course(course),
                program_title=course.title,
                amount=order.amount,
                status=order.status,
                payment_method=order.payment_method,
                created_at=order.created_at,
                paid_at=order.paid_at,
                survey_id=survey.id if survey else None,
                survey_status=survey.status if survey else None,
                final_pdf_url=survey.final_pdf_url if survey else None,
            )
        )
    return out


# ---------- 본인 설문 상세 / 수정 ---------------------------------------------


def _get_my_survey(
    db: Session, survey_id: int, user_id: int
) -> CounselingSurvey:
    survey = db.get(CounselingSurvey, survey_id)
    if survey is None or survey.user_id != user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="설문을 찾을 수 없습니다.")
    return survey


@router.get("/surveys/{survey_id}", response_model=SurveyDetailResponse)
def get_my_survey(
    survey_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SurveyDetailResponse:
    survey = _get_my_survey(db, survey_id, current_user.id)
    return SurveyDetailResponse.model_validate(survey)


@router.put("/surveys/{survey_id}", response_model=SurveyDetailResponse)
def update_my_survey(
    survey_id: int,
    payload: SurveyUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SurveyDetailResponse:
    survey = _get_my_survey(db, survey_id, current_user.id)
    if survey.status == CounselingStatus.COMPLETED:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="최종 의견서가 발급된 설문은 수정할 수 없습니다.",
        )

    survey.responses = payload.responses
    survey.status = CounselingStatus.SUBMITTED
    survey.ai_draft_url = None
    survey.draft_sent_at = None
    db.commit()
    db.refresh(survey)

    # 재생성을 위한 background task — submit_survey 와 동일한 흐름
    order = db.get(Order, survey.order_id)
    course = db.get(Course, order.course_id) if order else None
    user_info = {
        "이름": current_user.username,
        "이메일": current_user.email,
        "주문번호": str(survey.order_id),
    }
    background_tasks.add_task(
        _process_draft,
        survey.id,
        course.title if course else "(강의 정보 없음)",
        user_info,
    )

    return SurveyDetailResponse.model_validate(survey)


__all__ = ["router"]
