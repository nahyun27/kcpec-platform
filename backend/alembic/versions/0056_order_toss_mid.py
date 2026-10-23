"""주문별 토스 상점 아이디(toss_mid) (2026-10).

온라인 강의 전용 상점(kcpecbs0xp)이 생겨 결제 상점이 둘이 됐다. 승인·환불은
결제를 받은 상점의 키로만 되므로 주문마다 상점을 기록한다. 기존 주문은
NULL(= 기본 상점)로 둔다.

Revision ID: 0056
Revises: 0055
Create Date: 2026-10-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0056"
down_revision: Union[str, None] = "0055"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("toss_mid", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "toss_mid")
