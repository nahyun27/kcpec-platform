"""변호사 파트너 — 포털 링크(QR·안내문구) 이메일 발송용 email 컬럼 추가.
기존 파트너는 비어있을 수 있어 nullable.

Revision ID: 0051
Revises: 0050
Create Date: 2026-10-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0051"
down_revision: Union[str, None] = "0050"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "lawyer_partners", sa.Column("email", sa.String(length=255), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("lawyer_partners", "email")
