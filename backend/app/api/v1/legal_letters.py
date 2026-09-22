"""반성문·탄원서 — 심리상담 결제에 함께 담기는 부가 상품(각 5,000원).

고객이 직접 쓴 사건정보·작성자정보·본문을 법원 제출 서식에 채워 넣어
즉시 PDF로 발급한다. AI가 글을 새로 쓰지 않고, 관리자 검토 단계도 없다 —
반성문·탄원서는 작성자 본인의 진솔한 글이어야 하므로(AI가 대신 쓰면 법원이
오히려 진정성이 없다고 볼 수 있다는 게 실제 우려 사례로 언론에도 보도된
적 있음), 고객이 입력을 제출하는 즉시 서식에 옮겨 발급한다.
심리상담 의견서(AI 초안 + 관리자 검토, counseling.py)와는 의도적으로 다른
흐름이다.
"""

import secrets
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.orders import (
    LEGAL_LETTER_PRICE_DEFAULT,
    PETITION_LETTER_COURSE_TITLE,
    REPENTANCE_LETTER_COURSE_TITLE,
)
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.legal_letter_generator import LegalLetterInput, generate_legal_letter_pdf
from app.models.course import Course, CourseCategory
from app.models.legal_letter import LegalLetter, LegalLetterType
from app.models.order import Order, OrderStatus
from app.models.user import User

router = APIRouter(prefix="/legal-letters", tags=["legal-letters"])

COURSE_TITLE_BY_TYPE: dict[LegalLetterType, str] = {
    LegalLetterType.REPENTANCE: REPENTANCE_LETTER_COURSE_TITLE,
    LegalLetterType.PETITION: PETITION_LETTER_COURSE_TITLE,
}


def get_or_create_letter_course(db: Session, letter_type: LegalLetterType) -> Course:
    title = COURSE_TITLE_BY_TYPE[letter_type]
    course = db.scalar(select(Course).where(Course.title == title).limit(1))
    if course is None:
        course = Course(
            title=title,
            description="심리상담 결제 시 함께 신청하는 법원 제출용 서식 작성",
            category=CourseCategory.LAW_COMPLIANCE,
            price=LEGAL_LETTER_PRICE_DEFAULT,
            is_active=False,
        )
        db.add(course)
        db.flush()
    return course


class LegalLetterInfo(BaseModel):
    repentance_price: int
    petition_price: int


@router.get("/info", response_model=LegalLetterInfo)
def legal_letter_info(db: Session = Depends(get_db)) -> LegalLetterInfo:
    rep = db.scalar(
        select(Course.price).where(Course.title == REPENTANCE_LETTER_COURSE_TITLE).limit(1)
    )
    pet = db.scalar(
        select(Course.price).where(Course.title == PETITION_LETTER_COURSE_TITLE).limit(1)
    )
    return LegalLetterInfo(
        repentance_price=rep if rep is not None else LEGAL_LETTER_PRICE_DEFAULT,
        petition_price=pet if pet is not None else LEGAL_LETTER_PRICE_DEFAULT,
    )


class LegalLetterSubmitRequest(BaseModel):
    case_number: str | None = Field(default=None, max_length=100)
    charge_or_defendant: str = Field(min_length=1, max_length=200)
    court_name: str = Field(min_length=1, max_length=200)
    writer_name: str = Field(min_length=1, max_length=100)
    writer_birth: date
    writer_address: str = Field(min_length=1, max_length=300)
    writer_phone: str = Field(min_length=1, max_length=30)
    relationship: str | None = Field(default=None, max_length=50)
    content: str = Field(min_length=1, max_length=20_000)


class LegalLetterStatus(BaseModel):
    order_id: int
    letter_type: LegalLetterType
    course_title: str
    amount: int
    paid: bool
    # 아직 작성 폼을 제출하지 않았으면 None.
    submitted: bool
    pdf_url: str | None
    created_at: datetime | None


def _order_and_type(db: Session, order_id: int, user_id: int) -> tuple[Order, LegalLetterType]:
    order = db.get(Order, order_id)
    if order is None or order.user_id != user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="주문을 찾을 수 없습니다.")
    course = db.get(Course, order.course_id)
    letter_type = None
    if course is not None:
        for t, title in COURSE_TITLE_BY_TYPE.items():
            if course.title == title:
                letter_type = t
    if letter_type is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="반성문·탄원서 주문이 아닙니다."
        )
    return order, letter_type


@router.get("/{order_id}", response_model=LegalLetterStatus)
def get_legal_letter_status(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LegalLetterStatus:
    order, letter_type = _order_and_type(db, order_id, current_user.id)
    course = db.get(Course, order.course_id)
    letter = db.scalar(select(LegalLetter).where(LegalLetter.order_id == order.id))
    return LegalLetterStatus(
        order_id=order.id,
        letter_type=letter_type,
        course_title=course.title if course else "",
        amount=order.amount,
        paid=order.status == OrderStatus.PAID,
        submitted=letter is not None,
        pdf_url=letter.pdf_url if letter else None,
        created_at=letter.created_at if letter else None,
    )


@router.post("/{order_id}/submit", response_model=LegalLetterStatus)
def submit_legal_letter(
    order_id: int,
    payload: LegalLetterSubmitRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LegalLetterStatus:
    order, letter_type = _order_and_type(db, order_id, current_user.id)
    if order.status != OrderStatus.PAID:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="결제 완료된 주문만 작성할 수 있습니다.")

    existing = db.scalar(select(LegalLetter).where(LegalLetter.order_id == order.id))
    if existing is not None:
        course = db.get(Course, order.course_id)
        return LegalLetterStatus(
            order_id=order.id,
            letter_type=letter_type,
            course_title=course.title if course else "",
            amount=order.amount,
            paid=True,
            submitted=True,
            pdf_url=existing.pdf_url,
            created_at=existing.created_at,
        )

    if letter_type == LegalLetterType.PETITION and not (payload.relationship or "").strip():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="피고인과의 관계를 입력해 주세요."
        )

    access_token = secrets.token_urlsafe(24)
    issued_date = datetime.now(timezone.utc).date()

    pdf_path = generate_legal_letter_pdf(
        letter_type=letter_type.value,
        file_token=access_token,
        data=LegalLetterInput(
            case_number=(payload.case_number or "").strip() or None,
            charge_or_defendant=payload.charge_or_defendant.strip(),
            court_name=payload.court_name.strip(),
            writer_name=payload.writer_name.strip(),
            writer_birth=payload.writer_birth,
            writer_address=payload.writer_address.strip(),
            writer_phone=payload.writer_phone.strip(),
            relationship=(payload.relationship or "").strip() or None,
            content=payload.content.strip(),
        ),
        issued_date=issued_date,
    )
    pdf_url = str(request.url_for("static", path=f"pdfs/{pdf_path.name}"))

    letter = LegalLetter(
        order_id=order.id,
        user_id=current_user.id,
        letter_type=letter_type,
        case_number=(payload.case_number or "").strip() or None,
        charge_or_defendant=payload.charge_or_defendant.strip(),
        court_name=payload.court_name.strip(),
        writer_name=payload.writer_name.strip(),
        writer_birth=payload.writer_birth,
        writer_address=payload.writer_address.strip(),
        writer_phone=payload.writer_phone.strip(),
        relationship_to_defendant=(payload.relationship or "").strip() or None,
        content=payload.content.strip(),
        access_token=access_token,
        pdf_url=pdf_url,
    )
    db.add(letter)
    db.commit()
    db.refresh(letter)

    course = db.get(Course, order.course_id)
    return LegalLetterStatus(
        order_id=order.id,
        letter_type=letter_type,
        course_title=course.title if course else "",
        amount=order.amount,
        paid=True,
        submitted=True,
        pdf_url=letter.pdf_url,
        created_at=letter.created_at,
    )


__all__ = ["router", "get_or_create_letter_course"]
