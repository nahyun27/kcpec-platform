"""전문가 심리상담 독립 구매 흐름.

상담 프로그램 자체는 Course 테이블에 category=COUNSELING 으로 저장.
주문은 order_type=COUNSELING 로 만들어진다.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.counseling import _process_draft
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.counseling import CounselingStatus, CounselingSurvey
from app.models.course import Course, CourseCategory
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
    course = _resolve_course(db, payload.counseling_type)

    # basic 만 즉시 결제 흐름; phone/inperson 은 별도 문의 (status=pending 으로 남음)
    requires_payment = payload.counseling_type == "basic" and (course.price or 0) > 0
    amount = (course.price or 0) if requires_payment else 0

    order = Order(
        user_id=current_user.id,
        course_id=course.id,
        order_type=OrderType.COUNSELING,
        payment_method=PaymentMethod.CARD,
        amount=amount,
        status=OrderStatus.PENDING,
    )
    db.add(order)
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
