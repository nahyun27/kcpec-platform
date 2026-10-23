"""결제수단 페이코·엘페이·SSG페이 추가 (2026-10).

Revision ID: 0059
Revises: 0058
Create Date: 2026-10-23
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0059"
down_revision: Union[str, None] = "0058"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for value in ("payco", "lpay", "ssgpay"):
        op.execute(f"ALTER TYPE payment_method ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    pass
