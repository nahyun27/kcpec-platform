"""구속수용자 교육 신청에 신청자-수용자 관계 추가.

Revision ID: 0040
Revises: 0039
Create Date: 2026-09-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0040"
down_revision: Union[str, None] = "0039"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "detention_applications",
        sa.Column("applicant_relation", sa.String(length=30), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("detention_applications", "applicant_relation")
