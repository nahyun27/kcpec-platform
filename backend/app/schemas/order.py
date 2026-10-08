from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.order import OrderStatus, OrderType, PaymentMethod


class OrderCreate(BaseModel):
    course_id: int
    payment_method: PaymentMethod
    amount: int = Field(ge=0)


class OrderResponse(BaseModel):
    id: int
    course_id: int
    order_type: OrderType
    status: OrderStatus
    amount: int
    payment_method: PaymentMethod
    created_at: datetime
    paid_at: datetime | None
    # 마이페이지 카드 헤더 표시용 — list 응답에서 함께 내려보냄.
    course_title: str | None = None
    # 맞춤강의찾기 묶음결제로 같이 생성된 주문끼리 공유하는 값 — 마이페이지에서
    # 한 카드로 묶어 보여주는 데 사용.
    bundle_id: str | None = None
    # 구속수용자 교육(우편 자료) 수용자용 주문 — 온라인 수강 대상이 아님.
    detention_inmate: bool = False
    # 무통장입금(토스 가상계좌) 발급 정보 — 입금 대기 중에만 값이 있음.
    # va_secret(웹훅 검증용)은 절대 포함하지 않는다.
    va_account_number: str | None = None
    va_bank_code: str | None = None
    va_customer_name: str | None = None
    va_due_date: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class TossConfirm(BaseModel):
    payment_key: str
    order_id: int
    amount: int


class BankTransferConfirm(BaseModel):
    order_id: int


class BundleCreateRequest(BaseModel):
    # 사전결제 대상 강의 id 목록 — 중복 없이. 반성문·탄원서만 단독으로도
    # 주문할 수 있어(2026-10, "이것도 하나의 상품인데 단독 구매가 안 된다"는
    # 지적으로 추가) 여기 자체는 0개도 허용하고, course_ids/legal_letters
    # 둘 다 비어있지만 않으면 된다(model_validator로 검증).
    course_ids: list[int] = []
    payment_method: PaymentMethod
    # 함께 담을 반성문·탄원서(각 10,000원) — 선택.
    legal_letters: list[Literal["repentance", "petition"]] = []
    # 결제 시 입력한 변호사 사무실 추천 코드 — 유효하면 10% 추가 할인(2026-10).
    lawyer_referral_code: str | None = None

    @model_validator(mode="after")
    def _require_at_least_one_item(self) -> "BundleCreateRequest":
        if not self.course_ids and not self.legal_letters:
            raise ValueError("강의 또는 반성문·탄원서 중 하나는 선택해야 합니다.")
        return self


class BundleItem(BaseModel):
    order_id: int
    course_id: int
    course_title: str
    amount: int


class BundleCreateResponse(BaseModel):
    bundle_id: str
    subtotal: int
    discount: int
    # 변호사 리퍼럴 10% 할인 — 묶음 할인(discount) 적용 후 금액 기준으로 계산.
    # 선택 안 했으면 0.
    lawyer_discount: int = 0
    total: int
    payment_method: PaymentMethod
    items: list[BundleItem]


class BundleTossConfirm(BaseModel):
    bundle_id: str
    payment_key: str
    amount: int


class TossWebhookPayload(BaseModel):
    """토스 DEPOSIT_CALLBACK(가상계좌 입금완료) 웹훅 바디.

    토스가 그대로 보내는 camelCase 필드명 — 우리 프런트가 만드는 요청이
    아니라 그대로 받는다.
    """

    createdAt: str
    secret: str
    status: str
    transactionKey: str
    orderId: str
