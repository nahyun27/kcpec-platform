"""회원 계정에 변호사 추천 연결 — 가입/로그인 시 1회 연결되면 계정에 영구
저장(2026-10). 결제 화면마다 코드를 다시 입력할 필요 없이, 전용 링크
(/r/{code})로 들어와 가입·로그인하면 그 계정으로는 항상 자동 적용된다.

Revision ID: 0053
Revises: 0052
Create Date: 2026-10-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0053"
down_revision: Union[str, None] = "0052"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("lawyer_partner_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        op.f("ix_users_lawyer_partner_id"), "users", ["lawyer_partner_id"]
    )
    op.create_foreign_key(
        "fk_users_lawyer_partner_id",
        "users",
        "lawyer_partners",
        ["lawyer_partner_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_lawyer_partner_id", "users", type_="foreignkey")
    op.drop_index(op.f("ix_users_lawyer_partner_id"), table_name="users")
    op.drop_column("users", "lawyer_partner_id")
