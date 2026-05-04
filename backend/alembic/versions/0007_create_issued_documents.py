"""create issued_documents + add users.is_admin

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ISSUED_DOC_TYPES = ("certificate", "guide", "cbt")
ISSUED_DOC_STATUSES = ("pending", "ready")


def upgrade() -> None:
    doc_type = sa.Enum(*ISSUED_DOC_TYPES, name="issued_document_type")
    doc_status = sa.Enum(*ISSUED_DOC_STATUSES, name="issued_document_status")

    op.add_column(
        "users",
        sa.Column(
            "is_admin",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.create_table(
        "issued_documents",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "order_id",
            sa.Integer(),
            sa.ForeignKey("orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("document_type", doc_type, nullable=False),
        sa.Column("recipient_name", sa.String(length=100), nullable=False),
        sa.Column("recipient_birth", sa.Date(), nullable=False),
        sa.Column("pdf_url", sa.String(length=500), nullable=True),
        sa.Column("issue_number", sa.String(length=50), nullable=False),
        sa.Column("status", doc_status, nullable=False, server_default="pending"),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("issue_number", name="uq_issued_documents_issue_number"),
    )
    op.create_index("ix_issued_documents_order_id", "issued_documents", ["order_id"])
    op.create_index("ix_issued_documents_user_id", "issued_documents", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_issued_documents_user_id", table_name="issued_documents")
    op.drop_index("ix_issued_documents_order_id", table_name="issued_documents")
    op.drop_table("issued_documents")
    op.drop_column("users", "is_admin")
    bind = op.get_bind()
    sa.Enum(name="issued_document_status").drop(bind, checkfirst=True)
    sa.Enum(name="issued_document_type").drop(bind, checkfirst=True)
