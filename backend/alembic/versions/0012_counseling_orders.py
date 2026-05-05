"""Counseling 독립 구매 지원: order_type, nullable package_id, nullable price, course_category +'심리상담'

Revision ID: 0012
Revises: 0011
Create Date: 2026-05-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) order_type enum 신규 + orders 테이블에 컬럼 추가 (default 'course')
    sa.Enum("course", "counseling", name="order_type").create(op.get_bind(), checkfirst=True)
    op.add_column(
        "orders",
        sa.Column(
            "order_type",
            sa.Enum("course", "counseling", name="order_type"),
            nullable=False,
            server_default="course",
        ),
    )
    op.create_index("ix_orders_order_type", "orders", ["order_type"])

    # 2) orders.package_id 를 nullable 로 (심리상담 주문은 패키지 무관)
    op.alter_column("orders", "package_id", existing_type=sa.Integer(), nullable=True)

    # 3) courses.price 를 nullable 로 (별도 문의 프로그램용)
    op.alter_column("courses", "price", existing_type=sa.Integer(), nullable=True)

    # 4) course_category enum 에 '심리상담' 값 추가
    #    PostgreSQL 12+ 에서는 트랜잭션 내 ALTER TYPE ADD VALUE 가능.
    op.execute("ALTER TYPE course_category ADD VALUE IF NOT EXISTS '심리상담'")


def downgrade() -> None:
    op.alter_column("courses", "price", existing_type=sa.Integer(), nullable=False)
    op.alter_column("orders", "package_id", existing_type=sa.Integer(), nullable=False)
    op.drop_index("ix_orders_order_type", table_name="orders")
    op.drop_column("orders", "order_type")
    sa.Enum(name="order_type").drop(op.get_bind(), checkfirst=True)
    # course_category enum 의 '심리상담' 값은 PG 표준에서 안전하게 제거 불가 — 그대로 둔다.
