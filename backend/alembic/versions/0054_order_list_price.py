"""주문에 결제 당시 강의 정가(list_price) 저장 (2026-10).

관리자 주문 목록의 "정가 대비 할인" 표시가 현재 강의 가격을 기준으로
계산돼, 가격을 바꾸면 예전 주문의 할인 금액이 틀리게 보이던 문제 수정.
기존 주문은 현재 강의 가격으로 채운다(지금까지 화면에 보이던 값과 동일).

Revision ID: 0054
Revises: 0053
Create Date: 2026-10-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0054"
down_revision: Union[str, None] = "0053"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("list_price", sa.Integer(), nullable=True))
    op.execute(
        "UPDATE orders SET list_price = courses.price FROM courses WHERE courses.id = orders.course_id"
    )


def downgrade() -> None:
    op.drop_column("orders", "list_price")
