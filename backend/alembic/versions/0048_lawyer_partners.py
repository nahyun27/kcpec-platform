"""변호사 사무실 리퍼럴 파트너 — 결제 시 선택하면 10% 할인(2026-10).

lawyer_partners 테이블 신설 + orders.lawyer_partner_id FK(정산용이 아닌
기록용이라 파트너 삭제돼도 주문은 남도록 ON DELETE SET NULL).

Revision ID: 0048
Revises: 0047
Create Date: 2026-10-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0048"
down_revision: Union[str, None] = "0047"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lawyer_partners",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("law_firm_name", sa.String(length=200), nullable=False),
        sa.Column("lawyer_name", sa.String(length=100), nullable=False),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.add_column(
        "orders",
        sa.Column("lawyer_partner_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        op.f("ix_orders_lawyer_partner_id"), "orders", ["lawyer_partner_id"]
    )
    op.create_foreign_key(
        "fk_orders_lawyer_partner_id",
        "orders",
        "lawyer_partners",
        ["lawyer_partner_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_orders_lawyer_partner_id", "orders", type_="foreignkey")
    op.drop_index(op.f("ix_orders_lawyer_partner_id"), table_name="orders")
    op.drop_column("orders", "lawyer_partner_id")
    op.drop_table("lawyer_partners")
