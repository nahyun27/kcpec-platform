"""enrollments.expires_at 추가 — 결제 후 수강 가능 기간(기본 7일).

기존 enrollment 는 소급 적용하지 않음(NULL = 기간 제한 없음).
신규 enrollment 부터 enrolled_at + ENROLLMENT_ACCESS_DAYS 로 설정됨.

Revision ID: 0022
Revises: 0021
Create Date: 2026-09-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "enrollments", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("enrollments", "expires_at")
