"""legal_letters 필드 구성을 의뢰인 확정 항목에 맞게 재구성.

- charge_or_defendant → charge(죄명) + defendant_name(사건당사자 성명, 탄원서만)
- writer_address/writer_phone: 탄원서 생략 가능하도록 nullable 전환
- 반성문 전용 선택사항 추가: first_offense, prior_same_type_record,
  case_stage, settlement_status

Revision ID: 0044
Revises: 0043
Create Date: 2026-09-23
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0044"
down_revision: Union[str, None] = "0043"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "legal_letters", "charge_or_defendant", new_column_name="charge"
    )
    op.add_column(
        "legal_letters", sa.Column("defendant_name", sa.String(length=100), nullable=True)
    )
    op.alter_column("legal_letters", "writer_address", nullable=True)
    op.alter_column("legal_letters", "writer_phone", nullable=True)
    op.add_column(
        "legal_letters", sa.Column("first_offense", sa.Boolean(), nullable=True)
    )
    op.add_column(
        "legal_letters", sa.Column("prior_same_type_record", sa.Boolean(), nullable=True)
    )
    op.add_column(
        "legal_letters", sa.Column("case_stage", sa.String(length=50), nullable=True)
    )
    op.add_column(
        "legal_letters", sa.Column("settlement_status", sa.String(length=50), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("legal_letters", "settlement_status")
    op.drop_column("legal_letters", "case_stage")
    op.drop_column("legal_letters", "prior_same_type_record")
    op.drop_column("legal_letters", "first_offense")
    op.alter_column("legal_letters", "writer_phone", nullable=False)
    op.alter_column("legal_letters", "writer_address", nullable=False)
    op.drop_column("legal_letters", "defendant_name")
    op.alter_column(
        "legal_letters", "charge", new_column_name="charge_or_defendant"
    )
