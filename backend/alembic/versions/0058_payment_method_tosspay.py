"""결제수단 토스페이 추가 (2026-10).

강의 전용 상점(kcpecbs0xp)은 간편결제 계약이 있어 결제수단에서 카카오페이·
네이버페이·토스페이를 따로 고를 수 있게 한다.

Revision ID: 0058
Revises: 0057
Create Date: 2026-10-23
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0058"
down_revision: Union[str, None] = "0057"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL 12+ 에서는 트랜잭션 내 ALTER TYPE ADD VALUE 가능(0012 와 동일).
    op.execute("ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'tosspay'")


def downgrade() -> None:
    # enum 값 삭제는 PostgreSQL 이 지원하지 않아 그대로 둔다.
    pass
