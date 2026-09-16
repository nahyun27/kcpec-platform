"""posts 테이블에 user_id 컬럼 추가.

커뮤니티 Q&A를 공개 게시판에서 마이페이지 1:1 문의로 전환하면서, 작성자를
실제 로그인 계정에 연결해 본인과 관리자만 조회할 수 있게 한다. 기존(익명
허용 시절) 행은 소유자가 없으므로 nullable.

Revision ID: 0034
Revises: 0033
Create Date: 2026-09-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0034"
down_revision: Union[str, None] = "0033"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("user_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_posts_user_id"), "posts", ["user_id"])
    op.create_foreign_key(
        "fk_posts_user_id_users",
        "posts",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_posts_user_id_users", "posts", type_="foreignkey")
    op.drop_index(op.f("ix_posts_user_id"), table_name="posts")
    op.drop_column("posts", "user_id")
