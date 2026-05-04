"""create packages + package_documents

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PACKAGE_TIERS = ("basic", "standard", "premium")
DOCUMENT_TYPES = ("certificate", "guide", "counseling", "cbt", "consultation")


def upgrade() -> None:
    package_tier = sa.Enum(*PACKAGE_TIERS, name="package_tier")
    package_doc_type = sa.Enum(*DOCUMENT_TYPES, name="package_document_type")

    op.create_table(
        "packages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("tier", package_tier, nullable=False),
        sa.Column("price", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
    )

    op.create_table(
        "package_documents",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "package_id",
            sa.Integer(),
            sa.ForeignKey("packages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("document_type", package_doc_type, nullable=False),
    )
    op.create_index("ix_package_documents_package_id", "package_documents", ["package_id"])


def downgrade() -> None:
    op.drop_index("ix_package_documents_package_id", table_name="package_documents")
    op.drop_table("package_documents")
    op.drop_table("packages")
    bind = op.get_bind()
    sa.Enum(name="package_document_type").drop(bind, checkfirst=True)
    sa.Enum(name="package_tier").drop(bind, checkfirst=True)
