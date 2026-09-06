"""users 에 name/phone 컬럼 추가.

기존 사이트에서 실제 회원 데이터를 이관하는데, 이름/연락처를 저장할
컬럼이 users 테이블에 아예 없었다 (지금까지는 서류 발급 시점에만
recipient_name 을 그때그때 입력받는 구조). 어드민이 실제 고객을
식별(문의/환불 대응)할 수 있도록 프로필성 name/phone 을 추가한다.

Revision ID: 0028
Revises: 0027
Create Date: 2026-09-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0028"
down_revision: Union[str, None] = "0027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("name", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(length=30), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "phone")
    op.drop_column("users", "name")
