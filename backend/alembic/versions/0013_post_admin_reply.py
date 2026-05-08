"""add posts.admin_reply

Revision ID: 0013
Revises: 0012
Create Date: 2026-05-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "posts",
        sa.Column("admin_reply", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("posts", "admin_reply")
