"""users.email_verify_expires_at 컬럼 추가.

이메일 인증 토큰이 비밀번호 재설정 토큰과 달리 만료 없이 무기한 유효했다
— DB 유출이 아니어도, 오래된 인증 메일이 남아있는 한 계속 재사용 가능한
문제(2026-09, 버그 감사 중 발견). password_reset_expires_at 과 같은 패턴으로
발급 24시간 후 만료되게 한다.

Revision ID: 0032
Revises: 0031
Create Date: 2026-09-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0032"
down_revision: Union[str, None] = "0031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("email_verify_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "email_verify_expires_at")
