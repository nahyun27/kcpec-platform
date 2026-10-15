"""마케팅(혜택·안내) 메일 수신 동의 + 가입 안내 메일 발송 기록 (2026-10).

기존 회원은 동의를 받은 적이 없으므로 false 로 채운다(메일 대상 아님,
다시 묻지도 않음). 새 소셜 가입자만 NULL 로 시작해 첫 로그인 때 묻는다.

Revision ID: 0055
Revises: 0054
Create Date: 2026-10-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0055"
down_revision: Union[str, None] = "0054"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("marketing_consent", sa.Boolean(), nullable=True))
    op.add_column("users", sa.Column("marketing_consent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("welcome_mail_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE users SET marketing_consent = false")


def downgrade() -> None:
    op.drop_column("users", "welcome_mail_sent_at")
    op.drop_column("users", "marketing_consent_at")
    op.drop_column("users", "marketing_consent")
