"""반성문·탄원서 — 심리상담 결제에 함께 담기는 부가 상품(각 10,000원).

고객이 결제 후 사건정보·작성자정보와 선택사항(반성문: 초범 여부/사건
진행단계/합의 여부, 탄원서: 사건당사자·관계)에 답하고, 자유 서술 질문에
답하면 그 답변을 바탕으로 AI(Gemini)가 본문을 자동으로 작성해 법원 제출
서식에 채워 즉시 PDF로 발급한다. 관리자 검토 단계는 없다 — 그래서 AI 생성이
실패하면(gemini_client 의 심리상담 흐름과 달리) 더미 텍스트로 조용히
폴백하지 않고 502 를 돌려줘 고객이 다시 시도하게 한다(legal_letter_ai.py
참고). 주문은 이미 결제된 상태로 남아 재시도해도 다시 결제할 필요는 없다.

문항 구성(선택사항 목록·라벨)은 의뢰인이 확정한 내용을 legal_letter_ai.py 에
그대로 반영했다 — 바뀌면 그쪽만 교체하면 프론트 폼도 /info 응답을 통해
자동으로 따라간다(자유 서술 질문 라벨 한정 — 선택사항 자체는 이 파일의
스키마에 고정 필드로 박혀있어 구조가 바뀌면 여기도 같이 손봐야 함).
"""

import json
import secrets
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.orders import (
    LEGAL_LETTER_COURSE_TITLE_BY_TYPE,
    LEGAL_LETTER_PRICE_DEFAULT,
    PETITION_LETTER_COURSE_TITLE,
    REPENTANCE_LETTER_COURSE_TITLE,
    get_or_create_letter_course,
)
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.legal_letter_ai import (
    CASE_STAGE_OPTIONS,
    FREE_TEXT_QUESTION_LABELS,
    SETTLEMENT_STATUS_OPTIONS,
    LegalLetterAIError,
    generate_petition_content,
    generate_repentance_content,
)
from app.core.legal_letter_generator import LegalLetterInput, generate_legal_letter_pdf
from app.models.course import Course
from app.models.legal_letter import LegalLetter, LegalLetterType
from app.models.order import Order, OrderStatus
from app.models.user import User

router = APIRouter(prefix="/legal-letters", tags=["legal-letters"])

# get_or_create_letter_course 는 counseling_purchase.py(단건 상담 결제)와
# orders.py(맞춤강의찾기 등 일반 묶음결제) 양쪽이 다 써야 해서 orders.py 에
# 두고(순환 임포트 방지) 여기서는 재노출만 한다.
COURSE_TITLE_BY_TYPE = LEGAL_LETTER_COURSE_TITLE_BY_TYPE


class LegalLetterInfo(BaseModel):
    repentance_price: int
    petition_price: int
    # 반성문 전용 선택사항 옵션 목록(그대로 드롭다운/라디오로 렌더).
    case_stage_options: list[str]
    settlement_status_options: list[str]
    # 자유 서술 질문 key → 화면에 보일 라벨(순서 그대로 렌더).
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
        case_stage_options=CASE_STAGE_OPTIONS,
        settlement_status_options=SETTLEMENT_STATUS_OPTIONS,
        repentance_questions=FREE_TEXT_QUESTION_LABELS["repentance"],
        petition_questions=FREE_TEXT_QUESTION_LABELS["petition"],
    )


class LegalLetterSubmitRequest(BaseModel):
    case_number: str | None = Field(default=None, max_length=100)
    charge: str = Field(min_length=1, max_length=200)  # 죄명 — 공통
    court_name: str = Field(min_length=1, max_length=200)  # 관할명(경찰/검찰/법원 등)
    writer_name: str = Field(min_length=1, max_length=100)
    writer_birth: date
    # 탄원서는 생략 가능(의뢰인 확정 사항) — 반성문은 아래 model_validator 에서 필수로 강제.
    writer_address: str | None = Field(default=None, max_length=300)
    writer_phone: str | None = Field(default=None, max_length=30)

    # ---- 탄원서 전용 ----
    defendant_name: str | None = Field(default=None, max_length=100)  # 사건당사자 성명
    relationship: str | None = Field(default=None, max_length=50)  # 사건당사자와의 관계

    # ---- 반성문 전용 선택사항 ----
    first_offense: bool | None = None
    prior_same_type_record: bool | None = None  # first_offense=False 일 때만 사용
    case_stage: str | None = None
    settlement_status: str | None = None

    # 자유 서술 질문 key → 답변 — AI 가 이 답변을 바탕으로 본문을 작성한다.
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

    charge = payload.charge.strip()
    answers = {k: (v or "").strip() for k, v in payload.answers.items()}

    is_petition = letter_type == LegalLetterType.PETITION
    defendant_name = (payload.defendant_name or "").strip() or None
    relationship = (payload.relationship or "").strip() or None
    writer_address = (payload.writer_address or "").strip() or None
    writer_phone = (payload.writer_phone or "").strip() or None

    if is_petition:
        if not defendant_name:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="사건당사자 성명을 입력해 주세요.")
        if not relationship:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="사건당사자와의 관계를 입력해 주세요.")
    else:
        # 반성문은 주소·연락처가 필수(탄원서만 생략 가능하도록 의뢰인이 확정).
        if not writer_address:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="주소를 입력해 주세요.")
        if not writer_phone:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="연락처를 입력해 주세요.")
        if payload.first_offense is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="초범 여부를 선택해 주세요.")
        if not payload.first_offense and payload.prior_same_type_record is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, detail="동종 전과 여부를 선택해 주세요."
            )
        if not payload.case_stage or payload.case_stage not in CASE_STAGE_OPTIONS:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="사건 진행단계를 선택해 주세요.")
        if not payload.settlement_status or payload.settlement_status not in SETTLEMENT_STATUS_OPTIONS:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="합의 여부를 선택해 주세요.")

    try:
        if is_petition:
            content = generate_petition_content(
                charge=charge,
                defendant_name=defendant_name or "",
                relationship=relationship or "",
                answers=answers,
            )
        else:
            content = generate_repentance_content(
                charge=charge,
                first_offense=bool(payload.first_offense),
                prior_same_type_record=payload.prior_same_type_record,
                case_stage=payload.case_stage or "",
                settlement_status=payload.settlement_status or "",
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
            charge=charge,
            defendant_name=defendant_name,
            court_name=payload.court_name.strip(),
            writer_name=payload.writer_name.strip(),
            writer_birth=payload.writer_birth,
            writer_address=writer_address,
            writer_phone=writer_phone,
            relationship=relationship,
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
        charge=charge,
        defendant_name=defendant_name,
        court_name=payload.court_name.strip(),
        writer_name=payload.writer_name.strip(),
        writer_birth=payload.writer_birth,
        writer_address=writer_address,
        writer_phone=writer_phone,
        relationship_to_defendant=relationship,
        first_offense=payload.first_offense,
        prior_same_type_record=payload.prior_same_type_record,
        case_stage=payload.case_stage,
        settlement_status=payload.settlement_status,
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
