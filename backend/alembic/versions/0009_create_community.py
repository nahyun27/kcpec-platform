"""create notices + posts, add 'counseling' to issued_document_type enum

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NOTICE_CATEGORIES = ("notice", "resource")
POST_CATEGORIES = ("qna", "column", "review")


def upgrade() -> None:
    notice_category = sa.Enum(*NOTICE_CATEGORIES, name="notice_category")
    post_category = sa.Enum(*POST_CATEGORIES, name="post_category")

    op.create_table(
        "notices",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("category", notice_category, nullable=False),
        sa.Column("file_url", sa.String(length=500), nullable=True),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_notices_category", "notices", ["category"])

    op.create_table(
        "posts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("category", post_category, nullable=False),
        sa.Column(
            "author_name",
            sa.String(length=50),
            nullable=False,
            server_default="익명",
        ),
        sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_posts_category", "posts", ["category"])

    # 0007 에서 누락된 issued_document_type enum 의 'counseling' 값 추가.
    # PostgreSQL 12+ 에서는 트랜잭션 내에서도 ALTER TYPE ADD VALUE 가 가능.
    op.execute(
        "ALTER TYPE issued_document_type ADD VALUE IF NOT EXISTS 'counseling'"
    )


def downgrade() -> None:
    op.drop_index("ix_posts_category", table_name="posts")
    op.drop_table("posts")
    op.drop_index("ix_notices_category", table_name="notices")
    op.drop_table("notices")
    bind = op.get_bind()
    sa.Enum(name="post_category").drop(bind, checkfirst=True)
    sa.Enum(name="notice_category").drop(bind, checkfirst=True)
    # NOTE: PostgreSQL 은 ENUM 값 제거를 표준 지원하지 않아 'counseling' 은 그대로 둔다.
