"""create orders

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PAYMENT_METHODS = ("card", "kakaopay", "naverpay", "bank_transfer")
ORDER_STATUSES = ("pending", "paid", "cancelled", "refunded")


def upgrade() -> None:
    payment_method = sa.Enum(*PAYMENT_METHODS, name="payment_method")
    order_status = sa.Enum(*ORDER_STATUSES, name="order_status")

    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            sa.Integer(),
            sa.ForeignKey("courses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "package_id",
            sa.Integer(),
            sa.ForeignKey("packages.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("toss_payment_key", sa.String(length=255), nullable=True),
        sa.Column("payment_method", payment_method, nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("status", order_status, nullable=False, server_default="pending"),
        sa.Column("bank_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_orders_user_id", "orders", ["user_id"])
    op.create_index("ix_orders_course_id", "orders", ["course_id"])
    op.create_index("ix_orders_package_id", "orders", ["package_id"])
    op.create_index("ix_orders_status", "orders", ["status"])


def downgrade() -> None:
    op.drop_index("ix_orders_status", table_name="orders")
    op.drop_index("ix_orders_package_id", table_name="orders")
    op.drop_index("ix_orders_course_id", table_name="orders")
    op.drop_index("ix_orders_user_id", table_name="orders")
    op.drop_table("orders")
    bind = op.get_bind()
    sa.Enum(name="order_status").drop(bind, checkfirst=True)
    sa.Enum(name="payment_method").drop(bind, checkfirst=True)
