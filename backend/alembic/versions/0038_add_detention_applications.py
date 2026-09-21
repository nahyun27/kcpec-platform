"""구속수용자 교육 신청(detention_applications) 테이블 추가.

Revision ID: 0038
Revises: 0037
Create Date: 2026-09-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0038"
down_revision: Union[str, None] = "0037"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    status = sa.Enum(
        "received", "materials_sent", "completed", "cancelled", name="detention_status"
    )
    op.create_table(
        "detention_applications",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("bundle_id", sa.String(64), nullable=False, unique=True),
        sa.Column("inmate_name", sa.String(100), nullable=False),
        sa.Column("inmate_birth", sa.Date(), nullable=False),
        sa.Column("inmate_number", sa.String(50), nullable=False),
        sa.Column("facility_name", sa.String(100), nullable=False),
        sa.Column("postal_code", sa.String(10), nullable=True),
        sa.Column("address", sa.String(300), nullable=False),
        sa.Column("delivery_note", sa.String(300), nullable=True),
        sa.Column("contact_phone", sa.String(30), nullable=False),
        sa.Column("certificate_email", sa.String(255), nullable=False),
        sa.Column("status", status, nullable=False, server_default="received"),
        sa.Column("tracking_number", sa.String(100), nullable=True),
        sa.Column("admin_memo", sa.Text(), nullable=True),
        sa.Column("materials_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_detention_applications_user_id", "detention_applications", ["user_id"])
    op.create_index("ix_detention_applications_status", "detention_applications", ["status"])


def downgrade() -> None:
    op.drop_index("ix_detention_applications_status", table_name="detention_applications")
    op.drop_index("ix_detention_applications_user_id", table_name="detention_applications")
    op.drop_table("detention_applications")
    sa.Enum(name="detention_status").drop(op.get_bind(), checkfirst=True)
