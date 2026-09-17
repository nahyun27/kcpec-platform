"""users 테이블에 is_legacy_member 컬럼 추가.

구 사이트에서 이관된 회원인지, 새 플랫폼에서 직접 가입한 회원인지 관리자
화면에서 구분해서 보여주기 위함(2026-09-17, 회원 데이터 이관 직후 요청).

Revision ID: 0035
Revises: 0034
Create Date: 2026-09-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0035"
down_revision: Union[str, None] = "0034"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_legacy_member", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("users", "is_legacy_member")
