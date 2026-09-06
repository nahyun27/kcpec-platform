"""orders 에 bundle_id 컬럼 추가.

"맞춤 강의 찾기" 에서 여러 강의를 골라 10만원 이상이면 10,000원 할인을
적용해 한 번에 결제하는 기능(묶음결제) 지원용. 지금까지는 결제창까지만
만들어져 있고 실제로는 강의 1개만 주문/결제 가능해서 이 할인 문구가
완전히 장식으로만 존재했다(2026-09 발견).

묶음결제도 강의별로 개별 Order row 를 그대로 만들되(수강등록/환불/통계 등
기존 로직이 전부 "주문 1개 = 강의 1개" 를 가정하고 있어 그 불변식은 유지),
같은 결제 세션(토스 결제 1건 또는 무통장입금 1건)으로 묶인 주문들을
bundle_id 로 식별해 한꺼번에 승인/환불 처리한다.

Revision ID: 0029
Revises: 0028
Create Date: 2026-09-06
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0029"
down_revision: Union[str, None] = "0028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("bundle_id", sa.String(length=40), nullable=True))
    op.create_index("ix_orders_bundle_id", "orders", ["bundle_id"])


def downgrade() -> None:
    op.drop_index("ix_orders_bundle_id", table_name="orders")
    op.drop_column("orders", "bundle_id")
