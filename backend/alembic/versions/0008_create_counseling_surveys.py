"""create counseling_surveys

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


COUNSELING_STATUSES = ("submitted", "draft_generated", "sent_to_staff", "completed")


def upgrade() -> None:
    counseling_status = sa.Enum(*COUNSELING_STATUSES, name="counseling_status")

    op.create_table(
        "counseling_surveys",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "order_id",
            sa.Integer(),
            sa.ForeignKey("orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("responses", JSONB(), nullable=False),
        sa.Column("ai_draft_url", sa.String(length=500), nullable=True),
        sa.Column("draft_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("final_pdf_url", sa.String(length=500), nullable=True),
        sa.Column("status", counseling_status, nullable=False, server_default="submitted"),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("order_id", name="uq_counseling_surveys_order_id"),
    )
    op.create_index("ix_counseling_surveys_order_id", "counseling_surveys", ["order_id"])
    op.create_index("ix_counseling_surveys_user_id", "counseling_surveys", ["user_id"])
    op.create_index("ix_counseling_surveys_status", "counseling_surveys", ["status"])


def downgrade() -> None:
    op.drop_index("ix_counseling_surveys_status", table_name="counseling_surveys")
    op.drop_index("ix_counseling_surveys_user_id", table_name="counseling_surveys")
    op.drop_index("ix_counseling_surveys_order_id", table_name="counseling_surveys")
    op.drop_table("counseling_surveys")
    sa.Enum(name="counseling_status").drop(op.get_bind(), checkfirst=True)
