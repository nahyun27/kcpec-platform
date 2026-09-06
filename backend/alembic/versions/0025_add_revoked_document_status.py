"""issued_document_status 에 'revoked' 값 추가.

관리자가 결제 완료된 주문을 환불 처리할 때, 이미 발급된 수료증/의견서를
무효화할 방법이 없었다 (환불/취소 워크플로 자체가 아예 없었음 — 이번에
같이 추가). 법원 제출용 서류라 환불된 강의의 수료증이 계속 유효한 채로
남아있으면 안 되므로 'revoked' 상태를 추가하고, 환불 시 실제 PDF 파일도
같이 삭제한다.

Revision ID: 0025
Revises: 0024
Create Date: 2026-09-04
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0025"
down_revision: Union[str, None] = "0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE issued_document_status ADD VALUE IF NOT EXISTS 'revoked'")


def downgrade() -> None:
    # PostgreSQL 은 ENUM 값 제거를 표준 지원하지 않아 그대로 둔다.
    pass
