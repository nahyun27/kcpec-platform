"""users 에 비밀번호 재설정 토큰 컬럼 추가.

로그인 화면의 "비밀번호 찾기"가 href="#" 인 죽은 링크였고 백엔드에도
관련 엔드포인트가 전혀 없었음 — 이번에 같이 구현한다.

Revision ID: 0026
Revises: 0025
Create Date: 2026-09-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0026"
down_revision: Union[str, None] = "0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("password_reset_token", sa.String(length=64), nullable=True)
    )
    op.create_unique_constraint(
        "uq_users_password_reset_token", "users", ["password_reset_token"]
    )
    op.add_column(
        "users",
        sa.Column("password_reset_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "password_reset_expires_at")
    op.drop_constraint("uq_users_password_reset_token", "users", type_="unique")
    op.drop_column("users", "password_reset_token")
