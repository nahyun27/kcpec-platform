"""고객 환불 신청(2026-11).

수강 전 강의를 고객이 마이페이지에서 직접 환불 신청하고, 관리자가 승인하면
기존 관리자 환불(admin.refund_order)이 그대로 실행된다. 토스 가상계좌로 결제한
건은 토스 결제취소 API 가 환불받을 계좌(refundReceiveAccount)를 필수로 요구해서
신청 때 계좌를 받아 둔다. 계좌 정보는 처리(승인·거절·취소)가 끝나면 지운다.
"""

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RefundRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"  # 고객이 신청을 철회


class RefundRequest(Base):
    __tablename__ = "refund_requests"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[RefundRequestStatus] = mapped_column(
        Enum(
            RefundRequestStatus,
            name="refund_request_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=RefundRequestStatus.PENDING,
        index=True,
    )
    # 신청 시점에 고객에게 보여준 예상 환불액(승인 때 다시 계산한다).
    expected_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 토스 가상계좌 결제 건만 — 토스 은행 코드(숫자 2~3자리)
    refund_bank_code: Mapped[str | None] = mapped_column(String(8), nullable=True)
    refund_account_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    refund_holder_name: Mapped[str | None] = mapped_column(String(60), nullable=True)
    reject_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
