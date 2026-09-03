"""courses.original_price 추가 — 할인가 표시용 정가.

None 이면 할인 표시 안 함. price 보다 클 때만 프론트에서 취소선
정가 + 할인가로 노출.

Revision ID: 0021
Revises: 0020
Create Date: 2026-09-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("courses", sa.Column("original_price", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("courses", "original_price")
