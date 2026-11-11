"""고객 환불 신청 (2026-11).

Revision ID: 0061
Revises: 0060
Create Date: 2026-11-11
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "0061"
down_revision: Union[str, None] = "0060"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

status_enum = postgresql.ENUM(
    "pending", "approved", "rejected", "cancelled", name="refund_request_status", create_type=False
)


def upgrade() -> None:
    status_enum.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "refund_requests",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", status_enum, nullable=False, server_default="pending"),
        sa.Column("expected_amount", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("refund_bank_code", sa.String(8), nullable=True),
        sa.Column("refund_account_number", sa.String(32), nullable=True),
        sa.Column("refund_holder_name", sa.String(60), nullable=True),
        sa.Column("reject_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_refund_requests_order_id", "refund_requests", ["order_id"])
    op.create_index("ix_refund_requests_user_id", "refund_requests", ["user_id"])
    op.create_index("ix_refund_requests_status", "refund_requests", ["status"])


def downgrade() -> None:
    op.drop_table("refund_requests")
    status_enum.drop(op.get_bind(), checkfirst=True)
