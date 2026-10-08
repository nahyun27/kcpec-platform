"""변호사 파트너 — 자가 신청(/partner) + 관리자 승인 흐름 추가.
is_active(bool) 를 status(pending/active/inactive/rejected) 로 교체하고
phone 컬럼 추가. 기존 is_active=true -> active, is_active=false -> inactive.

Revision ID: 0052
Revises: 0051
Create Date: 2026-10-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0052"
down_revision: Union[str, None] = "0051"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

lawyer_partner_status = sa.Enum(
    "pending", "active", "inactive", "rejected", name="lawyer_partner_status"
)


def upgrade() -> None:
    op.add_column("lawyer_partners", sa.Column("phone", sa.String(length=50), nullable=True))

    lawyer_partner_status.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "lawyer_partners",
        sa.Column("status", lawyer_partner_status, nullable=True),
    )
    op.execute(
        "UPDATE lawyer_partners SET status = "
        "(CASE WHEN is_active THEN 'active' ELSE 'inactive' END)::lawyer_partner_status"
    )
    op.alter_column("lawyer_partners", "status", nullable=False)
    op.drop_column("lawyer_partners", "is_active")


def downgrade() -> None:
    op.add_column(
        "lawyer_partners",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.execute("UPDATE lawyer_partners SET is_active = (status = 'active')")
    op.drop_column("lawyer_partners", "status")
    lawyer_partner_status.drop(op.get_bind(), checkfirst=True)
    op.drop_column("lawyer_partners", "phone")
