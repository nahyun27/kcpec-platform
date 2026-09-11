"""payment_method enum 에 samsungpay/mobile_phone/transfer 값 추가.

삼성페이·휴대폰결제·실시간계좌이체 결제수단 지원 추가(2026-09). 가상계좌는
입금 완료를 알려주는 토스 웹훅 수신 서버가 별도로 필요해 이번엔 제외.

Revision ID: 0031
Revises: 0030
Create Date: 2026-09-11
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0031"
down_revision: Union[str, None] = "0030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'samsungpay'")
    op.execute("ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'mobile_phone'")
    op.execute("ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'transfer'")


def downgrade() -> None:
    # PostgreSQL 은 ENUM 값 제거를 표준 지원하지 않아 그대로 둔다.
    pass
