"""users 에 이메일 인증 컬럼 추가.

가입 시 이메일을 검증하지 않아 오타/타인 이메일로도 바로 가입되던 문제 —
그 이메일 주소로 수료증/심리상담 의견서가 자동 발송되므로 실제로 서류가
조용히 안 가는 사고로 이어질 수 있었다.

기존 가입자는 소급 인증 처리(is_verified=true) — 지금 시점 기준으로는
로컬 개발 데이터뿐이라 실사용자 영향 없음. 신규 가입자부터 미인증(false)
으로 시작해 이메일 인증을 거친다.

Revision ID: 0027
Revises: 0026
Create Date: 2026-09-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0027"
down_revision: Union[str, None] = "0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute("UPDATE users SET is_verified = true")
    op.add_column(
        "users", sa.Column("email_verify_token", sa.String(length=64), nullable=True)
    )
    op.create_unique_constraint(
        "uq_users_email_verify_token", "users", ["email_verify_token"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_users_email_verify_token", "users", type_="unique")
    op.drop_column("users", "email_verify_token")
    op.drop_column("users", "is_verified")
