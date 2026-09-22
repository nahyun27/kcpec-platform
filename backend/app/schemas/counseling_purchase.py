from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models.counseling import CounselingStatus
from app.models.order import OrderStatus, PaymentMethod


CounselingType = Literal["basic", "phone", "inperson"]


class CounselingPurchaseRequest(BaseModel):
    counseling_type: CounselingType
    # 심리상담 결제에 함께 담을 부가 상품(각 5,000원) — 선택.
    legal_letters: list[Literal["repentance", "petition"]] = []


class LegalLetterOrderRef(BaseModel):
    order_id: int
    letter_type: Literal["repentance", "petition"]
    amount: int


class CounselingPurchaseResponse(BaseModel):
    # 심리상담 주문 자체 — legal_letters 를 선택하지 않았을 때는 이 값이
    # 곧 "전체 결제 금액"이라 기존 프론트(단건 토스 결제)가 그대로 동작한다.
    order_id: int
    course_id: int
    amount: int
    status: OrderStatus
    payment_method: PaymentMethod
    requires_payment: bool
    counseling_type: CounselingType
    # 반성문·탄원서를 함께 선택했을 때만 값이 있음 — 있으면 프론트는 단건
    # 결제(/orders/toss/confirm) 대신 묶음결제(/orders/bundle/toss/confirm)
    # 흐름을 쓰고, amount 는 심리상담+부가상품 합계로 바뀐다.
    bundle_id: str | None = None
    legal_letter_orders: list[LegalLetterOrderRef] = []


class CounselingOrderItem(BaseModel):
    order_id: int
    counseling_type: CounselingType
    program_title: str
    amount: int
    status: OrderStatus
    payment_method: PaymentMethod
    created_at: datetime
    paid_at: datetime | None
    # 본인 설문 상세 조회 / 수정 시 사용 (제출 전이면 None).
    survey_id: int | None
    survey_status: CounselingStatus | None
    final_pdf_url: str | None

    model_config = ConfigDict(from_attributes=True)
