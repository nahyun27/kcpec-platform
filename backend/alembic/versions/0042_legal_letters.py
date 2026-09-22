"""반성문·탄원서(legal_letters) 테이블 추가.

Revision ID: 0042
Revises: 0041
Create Date: 2026-09-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0042"
down_revision: Union[str, None] = "0041"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    letter_type = sa.Enum("repentance", "petition", name="legal_letter_type")

    op.create_table(
        "legal_letters",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "order_id",
            sa.Integer(),
            sa.ForeignKey("orders.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("letter_type", letter_type, nullable=False),
        sa.Column("case_number", sa.String(length=100), nullable=True),
        sa.Column("charge_or_defendant", sa.String(length=200), nullable=False),
        sa.Column("court_name", sa.String(length=200), nullable=False),
        sa.Column("writer_name", sa.String(length=100), nullable=False),
        sa.Column("writer_birth", sa.Date(), nullable=False),
        sa.Column("writer_address", sa.String(length=300), nullable=False),
        sa.Column("writer_phone", sa.String(length=30), nullable=False),
        sa.Column("relationship_to_defendant", sa.String(length=50), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("access_token", sa.String(length=64), nullable=False, unique=True),
        sa.Column("pdf_url", sa.String(length=500), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_legal_letters_user_id", "legal_letters", ["user_id"])
    op.create_index("ix_legal_letters_order_id", "legal_letters", ["order_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_legal_letters_order_id", table_name="legal_letters")
    op.drop_index("ix_legal_letters_user_id", table_name="legal_letters")
    op.drop_table("legal_letters")
    sa.Enum(name="legal_letter_type").drop(op.get_bind(), checkfirst=True)
