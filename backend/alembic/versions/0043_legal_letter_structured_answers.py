"""legal_letters 에 고객 입력 원본(structured_answers) 컬럼 추가.

Revision ID: 0043
Revises: 0042
Create Date: 2026-09-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0043"
down_revision: Union[str, None] = "0042"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("legal_letters", sa.Column("structured_answers", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("legal_letters", "structured_answers")
