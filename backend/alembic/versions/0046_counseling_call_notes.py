"""전화 심화상담(15분 x 3회) 전용 — 상담사가 회차별로 남기는 통화 메모 3개 컬럼 추가.

Revision ID: 0046
Revises: 0045
Create Date: 2026-10-07
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0046"
down_revision: Union[str, None] = "0045"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("counseling_surveys", sa.Column("call_note_1", sa.Text(), nullable=True))
    op.add_column("counseling_surveys", sa.Column("call_note_2", sa.Text(), nullable=True))
    op.add_column("counseling_surveys", sa.Column("call_note_3", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("counseling_surveys", "call_note_3")
    op.drop_column("counseling_surveys", "call_note_2")
    op.drop_column("counseling_surveys", "call_note_1")
