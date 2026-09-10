"""issued_documents 에 pledge_pdf_url 컬럼 추가.

수료증 발급 시(과정별 서약서 템플릿이 있으면) 서약서 PDF 도 함께 생성해
같은 IssuedDocument row 에 붙여서 관리한다 — 수료증과 서약서는 항상 세트로
발급/재발급되는 문서라 별도 IssuedDocumentType/row 로 나눌 이유가 없음
(2026-09, 서약서 미발급 버그 수정).

Revision ID: 0030
Revises: 0029
Create Date: 2026-09-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0030"
down_revision: Union[str, None] = "0029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "issued_documents", sa.Column("pledge_pdf_url", sa.String(length=500), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("issued_documents", "pledge_pdf_url")
