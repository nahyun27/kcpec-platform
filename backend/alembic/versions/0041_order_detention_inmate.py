"""주문에 구속수용자 교육 수용자용 주문 표시(detention_inmate) 추가.

Revision ID: 0041
Revises: 0040
Create Date: 2026-09-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0041"
down_revision: Union[str, None] = "0040"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("detention_inmate", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # 이미 만들어진 구속수용자 교육 신청의 주문은 전부 수용자용으로 표시.
    op.execute(
        "UPDATE orders SET detention_inmate = TRUE "
        "WHERE bundle_id IN (SELECT bundle_id FROM detention_applications)"
    )


def downgrade() -> None:
    op.drop_column("orders", "detention_inmate")
