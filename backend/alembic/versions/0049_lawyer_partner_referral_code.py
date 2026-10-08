"""변호사 파트너 — 목록에서 고르는 방식이 아무나 할인받을 수 있는 허점이라,
사무실마다 고유 추천 코드를 발급해 그 코드를 아는 사람만 할인받게 변경.

기존 행은 nullable 로 추가한 뒤 코드를 백필하고, 그다음 NOT NULL + UNIQUE로
조인다.

Revision ID: 0049
Revises: 0048
Create Date: 2026-10-08
"""
import secrets
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0049"
down_revision: Union[str, None] = "0048"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _generate_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))


def upgrade() -> None:
    op.add_column(
        "lawyer_partners", sa.Column("referral_code", sa.String(length=16), nullable=True)
    )

    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id FROM lawyer_partners")).fetchall()
    used: set[str] = set()
    for (partner_id,) in rows:
        code = _generate_code()
        while code in used:
            code = _generate_code()
        used.add(code)
        bind.execute(
            sa.text("UPDATE lawyer_partners SET referral_code = :code WHERE id = :id"),
            {"code": code, "id": partner_id},
        )

    op.alter_column("lawyer_partners", "referral_code", nullable=False)
    op.create_unique_constraint(
        "uq_lawyer_partners_referral_code", "lawyer_partners", ["referral_code"]
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_lawyer_partners_referral_code", "lawyer_partners", type_="unique"
    )
    op.drop_column("lawyer_partners", "referral_code")
