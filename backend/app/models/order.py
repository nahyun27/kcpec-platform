import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PaymentMethod(str, enum.Enum):
    CARD = "card"
    KAKAOPAY = "kakaopay"
    NAVERPAY = "naverpay"
    SAMSUNGPAY = "samsungpay"
    MOBILE_PHONE = "mobile_phone"
    TRANSFER = "transfer"
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
    # 무통장입금(BANK_TRANSFER)을 토스 가상계좌 자동입금확인 방식으로 전환하며
    # 추가 — 주문마다 토스가 발급해주는 고유 계좌 정보. 카드 등 다른 결제수단과
    # 마이그레이션 이전 레거시 무통장입금 주문은 전부 None으로 남는다.
    # va_secret은 나중에 입금완료 웹훅(DEPOSIT_CALLBACK)을 검증하는 값이라
    # API 응답(OrderResponse)에는 절대 포함하지 않는다.
    va_account_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    va_bank_code: Mapped[str | None] = mapped_column(String(8), nullable=True)
    va_customer_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    va_due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    va_secret: Mapped[str | None] = mapped_column(String(255), nullable=True)
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
