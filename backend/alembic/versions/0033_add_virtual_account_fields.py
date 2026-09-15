"""orders 테이블에 가상계좌(Toss VIRTUAL_ACCOUNT) 발급 정보 컬럼 추가.

무통장입금을 토스 가상계좌 자동 확인 방식으로 전환 — 입금 대기 중인 주문에
발급된 계좌번호/은행/예금주/입금기한을 보여주고, 입금 완료 시 토스가 보내는
DEPOSIT_CALLBACK 웹훅을 검증할 비밀값(va_secret)을 저장해둔다.

Revision ID: 0033
Revises: 0032
Create Date: 2026-09-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0033"
down_revision: Union[str, None] = "0032"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("va_account_number", sa.String(64), nullable=True))
    op.add_column("orders", sa.Column("va_bank_code", sa.String(8), nullable=True))
    op.add_column("orders", sa.Column("va_customer_name", sa.String(100), nullable=True))
    op.add_column("orders", sa.Column("va_due_date", sa.DateTime(timezone=True), nullable=True))
    op.add_column("orders", sa.Column("va_secret", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "va_secret")
    op.drop_column("orders", "va_due_date")
    op.drop_column("orders", "va_customer_name")
    op.drop_column("orders", "va_bank_code")
    op.drop_column("orders", "va_account_number")
