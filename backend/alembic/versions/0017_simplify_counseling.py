"""심리상담 단일 상품화 — 전화/대면 심화상담 비활성화

심리상담 카테고리 3개 강의 중 '기본 프로그램' 만 단일 상품으로 운영.
'전화 심화상담' / '대면 심화상담' 은 is_active=false 로 비활성화.
(기존 주문 데이터 보존을 위해 삭제하지 않음)

Revision ID: 0017
Revises: 0016
Create Date: 2026-05-17
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 전화/대면 심화상담 비활성화. id 가 환경별로 다를 수 있어 title 매칭.
    op.execute(
        "UPDATE courses SET is_active = false "
        "WHERE category = '심리상담' "
        "AND title IN ('전화 심화상담', '대면 심화상담')"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE courses SET is_active = true "
        "WHERE category = '심리상담' "
        "AND title IN ('전화 심화상담', '대면 심화상담')"
    )
