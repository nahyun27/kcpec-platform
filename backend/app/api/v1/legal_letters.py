"""반성문·탄원서 — 심리상담 결제에 함께 담기는 부가 상품(각 10,000원).

고객이 결제 후 사건정보·작성자정보와 선택사항(반성문: 초범 여부/사건
진행단계/합의 여부, 탄원서: 사건당사자·관계)에 답하고, 자유 서술 질문에
답하면 그 답변을 바탕으로 AI(Gemini)가 본문 초안을 작성한다. 심리상담
의견서와 동일하게 관리자 검토를 거친 뒤 발급된다(2026-09, 초기에는 검토
없이 즉시 발급했으나 의뢰인 요청으로 변경) — 고객 제출 시점에는 초안만
만들어지고, 관리자가 검토·필요시 재생성/직접 수정한 뒤 "발급 확정"을
눌러야 PDF 가 생성되고 고객에게 공개된다.

문항 구성(선택사항 목록·라벨)은 의뢰인이 확정한 내용을 legal_letter_ai.py 에
그대로 반영했다 — 바뀌면 그쪽만 교체하면 프론트 폼도 /info 응답을 통해
자동으로 따라간다.
"""

import json
import secrets
from datetime import date, datetime, timezone
from typing import Literal

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
from app.core.admin import require_admin
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.email import send_legal_letter_released
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
admin_router = APIRouter(
    prefix="/admin/legal-letters",
    tags=["admin-legal-letters"],
    dependencies=[Depends(require_admin)],
)

# get_or_create_letter_course 는 counseling_purchase.py(단건 상담 결제)와
# orders.py(맞춤강의찾기 등 일반 묶음결제) 양쪽이 다 써야 해서 orders.py 에
# 두고(순환 임포트 방지) 여기서는 재노출만 한다.
COURSE_TITLE_BY_TYPE = LEGAL_LETTER_COURSE_TITLE_BY_TYPE


LABEL_BY_TYPE = {LegalLetterType.REPENTANCE: "반성문", LegalLetterType.PETITION: "탄원서"}


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
    # 탄원서는 생략 가능(의뢰인 확정 사항) — 반성문은 아래에서 필수로 강제.
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


LegalLetterUiStatus = Literal["not_submitted", "pending_review", "released"]


class LegalLetterStatus(BaseModel):
    order_id: int
    letter_type: LegalLetterType
    course_title: str
    amount: int
    paid: bool
    status: LegalLetterUiStatus
    pdf_url: str | None
    created_at: datetime | None
    released_at: datetime | None


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
    if letter is None:
        ui_status: LegalLetterUiStatus = "not_submitted"
    elif letter.released_at is None:
        ui_status = "pending_review"
    else:
        ui_status = "released"
    return LegalLetterStatus(
        order_id=order.id,
        letter_type=letter_type,
        course_title=course.title if course else "",
        amount=order.amount,
        paid=order.status == OrderStatus.PAID,
        status=ui_status,
        pdf_url=letter.pdf_url if letter and letter.released_at else None,
        created_at=letter.created_at if letter else None,
        released_at=letter.released_at if letter else None,
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

    # 이 시점엔 초안만 저장 — PDF 는 관리자가 검토 후 "발급 확정"을 눌러야 생성된다.
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
    )
    db.add(letter)
    db.commit()
    db.refresh(letter)

    return _status_response(db, order, letter_type, letter)


# ---------- admin ----------------------------------------------------------


class AdminLegalLetterRow(BaseModel):
    id: int
    order_id: int
    letter_type: LegalLetterType
    letter_label: str
    buyer_username: str
    buyer_email: str
    case_number: str | None
    charge: str
    defendant_name: str | None
    court_name: str
    writer_name: str
    writer_birth: date
    writer_address: str | None
    writer_phone: str | None
    relationship_to_defendant: str | None
    first_offense: bool | None
    prior_same_type_record: bool | None
    case_stage: str | None
    settlement_status: str | None
    answers: dict[str, str]
    answer_labels: dict[str, str]
    content: str
    pdf_url: str | None
    created_at: datetime
    released_at: datetime | None


def _admin_row(db: Session, letter: LegalLetter) -> AdminLegalLetterRow:
    order = db.get(Order, letter.order_id)
    buyer = db.get(User, letter.user_id)
    try:
        answers = json.loads(letter.structured_answers) if letter.structured_answers else {}
    except (json.JSONDecodeError, TypeError):
        answers = {}
    labels = FREE_TEXT_QUESTION_LABELS.get(letter.letter_type.value, {})
    return AdminLegalLetterRow(
        id=letter.id,
        order_id=letter.order_id,
        letter_type=letter.letter_type,
        letter_label=LABEL_BY_TYPE[letter.letter_type],
        buyer_username=buyer.username if buyer else "",
        buyer_email=buyer.email if buyer else "",
        case_number=letter.case_number,
        charge=letter.charge,
        defendant_name=letter.defendant_name,
        court_name=letter.court_name,
        writer_name=letter.writer_name,
        writer_birth=letter.writer_birth,
        writer_address=letter.writer_address,
        writer_phone=letter.writer_phone,
        relationship_to_defendant=letter.relationship_to_defendant,
        first_offense=letter.first_offense,
        prior_same_type_record=letter.prior_same_type_record,
        case_stage=letter.case_stage,
        settlement_status=letter.settlement_status,
        answers=answers,
        answer_labels=labels,
        content=letter.content,
        pdf_url=letter.pdf_url if letter.released_at else None,
        created_at=letter.created_at,
        released_at=letter.released_at,
    )


@admin_router.get("", response_model=list[AdminLegalLetterRow])
def admin_list_legal_letters(
    pending_only: bool = False,
    db: Session = Depends(get_db),
) -> list[AdminLegalLetterRow]:
    stmt = select(LegalLetter).order_by(LegalLetter.id.desc())
    if pending_only:
        stmt = stmt.where(LegalLetter.released_at.is_(None))
    return [_admin_row(db, letter) for letter in db.scalars(stmt).all()]


def _get_letter_or_404(db: Session, letter_id: int) -> LegalLetter:
    letter = db.get(LegalLetter, letter_id)
    if letter is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="신청을 찾을 수 없습니다.")
    return letter


@admin_router.post("/{letter_id}/regenerate", response_model=AdminLegalLetterRow)
def admin_regenerate_legal_letter(
    letter_id: int,
    db: Session = Depends(get_db),
) -> AdminLegalLetterRow:
    """저장된 답변 그대로 AI를 다시 돌려 본문을 새로 만든다(고객 재입력 불필요)."""
    letter = _get_letter_or_404(db, letter_id)
    if letter.released_at is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="이미 발급 확정된 건은 다시 생성할 수 없습니다.")

    try:
        answers = json.loads(letter.structured_answers) if letter.structured_answers else {}
    except (json.JSONDecodeError, TypeError):
        answers = {}

    try:
        if letter.letter_type == LegalLetterType.PETITION:
            content = generate_petition_content(
                charge=letter.charge,
                defendant_name=letter.defendant_name or "",
                relationship=letter.relationship_to_defendant or "",
                answers=answers,
            )
        else:
            content = generate_repentance_content(
                charge=letter.charge,
                first_offense=bool(letter.first_offense),
                prior_same_type_record=letter.prior_same_type_record,
                case_stage=letter.case_stage or "",
                settlement_status=letter.settlement_status or "",
                answers=answers,
            )
    except LegalLetterAIError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, detail=f"자동 작성에 실패했습니다: {exc}"
        ) from exc

    letter.content = content
    db.commit()
    db.refresh(letter)
    return _admin_row(db, letter)


class AdminLegalLetterContentPatch(BaseModel):
    content: str = Field(min_length=1)


@admin_router.patch("/{letter_id}", response_model=AdminLegalLetterRow)
def admin_edit_legal_letter(
    letter_id: int,
    payload: AdminLegalLetterContentPatch,
    db: Session = Depends(get_db),
) -> AdminLegalLetterRow:
    """관리자가 본문을 직접 수정(미세 교정용) — AI 재생성 대신 손으로 고칠 때."""
    letter = _get_letter_or_404(db, letter_id)
    if letter.released_at is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="이미 발급 확정된 건은 수정할 수 없습니다.")
    letter.content = payload.content.strip()
    db.commit()
    db.refresh(letter)
    return _admin_row(db, letter)


@admin_router.post("/{letter_id}/release", response_model=AdminLegalLetterRow)
def admin_release_legal_letter(
    letter_id: int,
    request: Request,
    db: Session = Depends(get_db),
) -> AdminLegalLetterRow:
    """검토 완료 — 현재 content 로 PDF 를 만들어 고객에게 공개하고 메일로 알린다."""
    letter = _get_letter_or_404(db, letter_id)
    if letter.released_at is not None:
        return _admin_row(db, letter)

    buyer = db.get(User, letter.user_id)
    access_token = secrets.token_urlsafe(24)
    issued_date = datetime.now(timezone.utc).date()

    pdf_path = generate_legal_letter_pdf(
        letter_type=letter.letter_type.value,
        file_token=access_token,
        data=LegalLetterInput(
            case_number=letter.case_number,
            charge=letter.charge,
            defendant_name=letter.defendant_name,
            court_name=letter.court_name,
            writer_name=letter.writer_name,
            writer_birth=letter.writer_birth,
            writer_address=letter.writer_address,
            writer_phone=letter.writer_phone,
            relationship=letter.relationship_to_defendant,
            content=letter.content,
        ),
        issued_date=issued_date,
    )
    letter.access_token = access_token
    letter.pdf_url = str(request.url_for("static", path=f"pdfs/{pdf_path.name}"))
    letter.released_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(letter)

    if buyer:
        send_legal_letter_released(
            to_email=buyer.email,
            recipient_name=letter.writer_name,
            letter_label=LABEL_BY_TYPE[letter.letter_type],
            pdf_url=letter.pdf_url,
        )

    return _admin_row(db, letter)


__all__ = ["router", "admin_router", "get_or_create_letter_course"]
