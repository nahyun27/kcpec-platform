from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.order import OrderStatus, OrderType, PaymentMethod


class OrderCreate(BaseModel):
    course_id: int
    package_id: int
    payment_method: PaymentMethod
    amount: int = Field(ge=0)


class OrderResponse(BaseModel):
    id: int
    course_id: int
    package_id: int | None
    order_type: OrderType
    status: OrderStatus
    amount: int
    payment_method: PaymentMethod
    created_at: datetime
    paid_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class TossConfirm(BaseModel):
    payment_key: str
    order_id: int
    amount: int
    # 프론트가 시뮬레이션 분기로 진입한 경우 명시적으로 표시.
    # 백엔드 TOSS_SECRET_KEY 가 설정되어 있더라도 이 플래그가 true 면 실제
    # Toss API 호출을 건너뛰고 mock paid 처리 (개발 편의용).
    is_simulated: bool = False


class BankTransferConfirm(BaseModel):
    order_id: int
