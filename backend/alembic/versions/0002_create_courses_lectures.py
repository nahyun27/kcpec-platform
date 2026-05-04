"""create courses + lectures tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CATEGORY_VALUES = (
    "준법",
    "음주",
    "성범죄",
    "성매매",
    "디지털성범죄",
    "마약",
    "도박",
    "피싱",
    "재산범죄",
    "스토킹",
    "학교폭력",
)


def upgrade() -> None:
    course_category = sa.Enum(*CATEGORY_VALUES, name="course_category")
    course_category.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "courses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", course_category, nullable=False),
        sa.Column("thumbnail_url", sa.String(length=500), nullable=True),
        sa.Column("price", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("min_progress_pct", sa.Integer(), nullable=False, server_default="90"),
        sa.Column("quiz_pass_score", sa.Integer(), nullable=False, server_default="70"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_courses_category", "courses", ["category"])

    op.create_table(
        "lectures",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "course_id",
            sa.Integer(),
            sa.ForeignKey("courses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("video_url", sa.String(length=500), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_lectures_course_id", "lectures", ["course_id"])


def downgrade() -> None:
    op.drop_index("ix_lectures_course_id", table_name="lectures")
    op.drop_table("lectures")
    op.drop_index("ix_courses_category", table_name="courses")
    op.drop_table("courses")
    sa.Enum(name="course_category").drop(op.get_bind(), checkfirst=True)
