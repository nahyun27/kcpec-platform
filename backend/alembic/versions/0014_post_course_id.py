"""add posts.course_id (수강 후기 → 강의 연결)

Revision ID: 0014
Revises: 0013
Create Date: 2026-05-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "posts",
        sa.Column("course_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_posts_course_id",
        "posts",
        "courses",
        ["course_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_posts_course_id", "posts", ["course_id"])


def downgrade() -> None:
    op.drop_index("ix_posts_course_id", table_name="posts")
    op.drop_constraint("fk_posts_course_id", "posts", type_="foreignkey")
    op.drop_column("posts", "course_id")
