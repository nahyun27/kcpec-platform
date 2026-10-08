"""변호사 전용 "마이페이지"(본인 추천 코드·누적 소개 건수 확인) 링크용
portal_token 추가 — referral_code 는 의뢰인도 알게 되는 값이라 재사용하면
안 돼서 완전히 별도의 긴 랜덤 토큰을 쓴다.

Revision ID: 0050
Revises: 0049
Create Date: 2026-10-08
"""
import secrets
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0050"
down_revision: Union[str, None] = "0049"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "lawyer_partners", sa.Column("portal_token", sa.String(length=64), nullable=True)
    )

    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id FROM lawyer_partners")).fetchall()
    used: set[str] = set()
    for (partner_id,) in rows:
        token = secrets.token_urlsafe(32)
        while token in used:
            token = secrets.token_urlsafe(32)
        used.add(token)
        bind.execute(
            sa.text("UPDATE lawyer_partners SET portal_token = :token WHERE id = :id"),
            {"token": token, "id": partner_id},
        )

    op.alter_column("lawyer_partners", "portal_token", nullable=False)
    op.create_unique_constraint(
        "uq_lawyer_partners_portal_token", "lawyer_partners", ["portal_token"]
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_lawyer_partners_portal_token", "lawyer_partners", type_="unique"
    )
    op.drop_column("lawyer_partners", "portal_token")
