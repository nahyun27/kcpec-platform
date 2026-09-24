"""반성문·탄원서에 관리자 검토 단계 추가 — access_token/pdf_url을 nullable로,
released_at 컬럼 추가.

legal_letters 테이블은 아직 실 데이터가 없어(2026-09-24 기준 0건) 데이터
백필 없이 바로 컬럼 제약만 바꾼다.

Revision ID: 0045
Revises: 0044
Create Date: 2026-09-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0045"
down_revision: Union[str, None] = "0044"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("legal_letters", "access_token", nullable=True)
    op.alter_column("legal_letters", "pdf_url", nullable=True)
    op.add_column(
        "legal_letters", sa.Column("released_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("legal_letters", "released_at")
    op.alter_column("legal_letters", "pdf_url", nullable=False)
    op.alter_column("legal_letters", "access_token", nullable=False)
