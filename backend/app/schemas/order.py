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


class BankTransferConfirm(BaseModel):
    order_id: int
