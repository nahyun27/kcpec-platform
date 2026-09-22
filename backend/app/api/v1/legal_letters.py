"""반성문·탄원서 — 심리상담 결제에 함께 담기는 부가 상품(각 10,000원).

고객이 결제 후 사건정보·작성자정보와 몇 가지 질문(선택사항)에 답하면, 그
답변을 바탕으로 AI(Gemini)가 본문을 자동으로 작성해 법원 제출 서식에 채워
즉시 PDF로 발급한다. 관리자 검토 단계는 없다 — 그래서 AI 생성이 실패하면
(gemini_client 의 심리상담 흐름과 달리) 더미 텍스트로 조용히 폴백하지 않고
502 를 돌려줘 고객이 다시 시도하게 한다(legal_letter_ai.py 참고). 주문은
이미 결제된 상태로 남아 재시도해도 다시 결제할 필요는 없다.

질문 구성(문항 라벨)은 의뢰인이 추후 확정할 예정이라 legal_letter_ai.py 의
DEFAULT_QUESTION_LABELS 를 잠정값으로 쓰고 있다 — 바뀌면 그쪽만 교체하면
프론트 폼도 /info 응답을 통해 자동으로 따라간다.
"""

import json
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
from app.core.legal_letter_ai import (
    DEFAULT_QUESTION_LABELS,
    LegalLetterAIError,
    generate_legal_letter_content,
)
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
            description="심리상담 결제 시 함께 신청하는 법원 제출용 서식 자동 작성",
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
    # 질문 key → 화면에 보일 라벨. 프론트는 이 순서/라벨 그대로 입력칸을 그린다.
    repentance_questions: dict[str, str]
    petition_questions: dict[str, str]


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
        repentance_questions=DEFAULT_QUESTION_LABELS["repentance"],
        petition_questions=DEFAULT_QUESTION_LABELS["petition"],
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
    # 질문 key → 답변. AI 가 이 답변을 바탕으로 본문을 작성한다(사실을
    # 지어내지 않도록 프롬프트에서 제한 — legal_letter_ai.py 참고).
    answers: dict[str, str] = Field(min_length=1)


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


def _status_response(
    db: Session, order: Order, letter_type: LegalLetterType, letter: LegalLetter | None
) -> LegalLetterStatus:
    course = db.get(Course, order.course_id)
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


@router.get("/{order_id}", response_model=LegalLetterStatus)
def get_legal_letter_status(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LegalLetterStatus:
    order, letter_type = _order_and_type(db, order_id, current_user.id)
    letter = db.scalar(select(LegalLetter).where(LegalLetter.order_id == order.id))
    return _status_response(db, order, letter_type, letter)


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
        return _status_response(db, order, letter_type, existing)

    if letter_type == LegalLetterType.PETITION and not (payload.relationship or "").strip():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="피고인과의 관계를 입력해 주세요."
        )

    charge_or_defendant = payload.charge_or_defendant.strip()
    answers = {k: (v or "").strip() for k, v in payload.answers.items()}

    try:
        content = generate_legal_letter_content(
            letter_type=letter_type.value,
            charge_or_defendant=charge_or_defendant,
            answers=answers,
        )
    except LegalLetterAIError as exc:
        # 실패해도 결제는 이미 끝난 상태 — LegalLetter row 를 만들지 않으므로
        # 고객은 같은 화면에서 다시 제출을 시도할 수 있다(재결제 불필요).
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail=f"자동 작성에 실패했습니다. 잠시 후 다시 시도해 주세요. ({exc})",
        ) from exc

    access_token = secrets.token_urlsafe(24)
    issued_date = datetime.now(timezone.utc).date()

    pdf_path = generate_legal_letter_pdf(
        letter_type=letter_type.value,
        file_token=access_token,
        data=LegalLetterInput(
            case_number=(payload.case_number or "").strip() or None,
            charge_or_defendant=charge_or_defendant,
            court_name=payload.court_name.strip(),
            writer_name=payload.writer_name.strip(),
            writer_birth=payload.writer_birth,
            writer_address=payload.writer_address.strip(),
            writer_phone=payload.writer_phone.strip(),
            relationship=(payload.relationship or "").strip() or None,
            content=content,
        ),
        issued_date=issued_date,
    )
    pdf_url = str(request.url_for("static", path=f"pdfs/{pdf_path.name}"))

    letter = LegalLetter(
        order_id=order.id,
        user_id=current_user.id,
        letter_type=letter_type,
        case_number=(payload.case_number or "").strip() or None,
        charge_or_defendant=charge_or_defendant,
        court_name=payload.court_name.strip(),
        writer_name=payload.writer_name.strip(),
        writer_birth=payload.writer_birth,
        writer_address=payload.writer_address.strip(),
        writer_phone=payload.writer_phone.strip(),
        relationship_to_defendant=(payload.relationship or "").strip() or None,
        structured_answers=json.dumps(answers, ensure_ascii=False),
        content=content,
        access_token=access_token,
        pdf_url=pdf_url,
    )
    db.add(letter)
    db.commit()
    db.refresh(letter)

    return _status_response(db, order, letter_type, letter)


__all__ = ["router", "get_or_create_letter_course"]
