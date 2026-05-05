"""add notices.author_name + posts.course_category

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notices",
        sa.Column(
            "author_name",
            sa.String(length=50),
            nullable=False,
            server_default="한국범죄예방교육센터",
        ),
    )
    op.add_column(
        "posts",
        sa.Column("course_category", sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("posts", "course_category")
    op.drop_column("notices", "author_name")
