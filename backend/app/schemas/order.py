from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

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
    # 사전결제 대상 강의 id 목록. 최소 1개, 중복 없이.
    course_ids: list[int] = Field(min_length=1)
    payment_method: PaymentMethod


class BundleItem(BaseModel):
    order_id: int
    course_id: int
    course_title: str
    amount: int


class BundleCreateResponse(BaseModel):
    bundle_id: str
    subtotal: int
    discount: int
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
