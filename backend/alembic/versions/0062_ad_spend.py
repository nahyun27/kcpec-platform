"""광고비 기록 (2026-11).

Revision ID: 0062
Revises: 0061
Create Date: 2026-11-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0062"
down_revision: Union[str, None] = "0061"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ad_spend",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("channel", sa.String(30), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("granularity", sa.String(10), nullable=False),
        sa.Column("cost", sa.Integer(), nullable=False),
        sa.Column("impressions", sa.Integer(), nullable=True),
        sa.Column("clicks", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("channel", "day", "granularity", name="uq_ad_spend_channel_day_gran"),
    )
    op.create_index("ix_ad_spend_channel", "ad_spend", ["channel"])
    op.create_index("ix_ad_spend_day", "ad_spend", ["day"])


def downgrade() -> None:
    op.drop_table("ad_spend")
