import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PaymentMethod(str, enum.Enum):
    CARD = "card"
    KAKAOPAY = "kakaopay"
    NAVERPAY = "naverpay"
    BANK_TRANSFER = "bank_transfer"


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class OrderType(str, enum.Enum):
    COURSE = "course"
    COUNSELING = "counseling"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_type: Mapped[OrderType] = mapped_column(
        Enum(OrderType, name="order_type", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=OrderType.COURSE,
        index=True,
    )
    toss_payment_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payment_method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod, name="payment_method", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=OrderStatus.PENDING,
        index=True,
    )
    bank_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # 묶음결제(여러 강의를 한 번의 결제로 + 10만원 이상 할인)로 생성된 경우,
    # 같은 결제 세션에 속한 주문들을 하나로 묶어 식별하는 랜덤 토큰.
    # 단일 강의 주문은 None.
    bundle_id: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    documents: Mapped[list["IssuedDocument"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
    )


from app.models.document import IssuedDocument  # noqa: E402,F401
