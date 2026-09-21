"""구속수용자 교육 신청에 보호자 학습 완료 확인 시각 추가.

Revision ID: 0039
Revises: 0038
Create Date: 2026-09-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0039"
down_revision: Union[str, None] = "0038"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "detention_applications",
        sa.Column("learning_confirmed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("detention_applications", "learning_confirmed_at")
