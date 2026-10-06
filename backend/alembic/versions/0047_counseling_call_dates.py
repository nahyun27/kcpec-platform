"""전화 심화상담 전용 의견서 양식의 "상담회차" 표에 쓰이는 회차별 통화 날짜
3개 컬럼 추가 — call_note_N 과 1:1 대응.

Revision ID: 0047
Revises: 0046
Create Date: 2026-10-07
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0047"
down_revision: Union[str, None] = "0046"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("counseling_surveys", sa.Column("call_date_1", sa.Date(), nullable=True))
    op.add_column("counseling_surveys", sa.Column("call_date_2", sa.Date(), nullable=True))
    op.add_column("counseling_surveys", sa.Column("call_date_3", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("counseling_surveys", "call_date_3")
    op.drop_column("counseling_surveys", "call_date_2")
    op.drop_column("counseling_surveys", "call_date_1")
