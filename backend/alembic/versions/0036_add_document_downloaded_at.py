"""issued_documents 테이블에 downloaded_at 컬럼 추가.

관리자가 발급된 수료증/의견서를 실제로 당사자가 다운로드했는지 확인하고
싶어함(2026-09). 다운로드 버튼 최초 클릭 시각만 기록.

Revision ID: 0036
Revises: 0035
Create Date: 2026-09-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0036"
down_revision: Union[str, None] = "0035"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "issued_documents", sa.Column("downloaded_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("issued_documents", "downloaded_at")
