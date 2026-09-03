"""사전결제 모델 전환 — 패키지 관련 테이블과 컬럼 일괄 제거.

- orders.package_id 컬럼 + FK 제거
- package_documents 테이블 drop
- packages 테이블 drop
- DocumentType / PackageTier enum drop

비즈니스 변경: 수료 후 패키지 결제 → 강의 단위 사전결제로 전환.
amount = course.price, 수료증은 수료 완료 시 자동 발급.

Revision ID: 0019
Revises: 0018
Create Date: 2026-05-28
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) orders.package_id FK + 인덱스 + 컬럼 제거
    op.execute("ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_package_id_fkey")
    op.execute("DROP INDEX IF EXISTS ix_orders_package_id")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS package_id")

    # 2) package_documents (자식) 먼저 drop
    op.execute("DROP TABLE IF EXISTS package_documents CASCADE")

    # 3) packages 본체 drop
    op.execute("DROP TABLE IF EXISTS packages CASCADE")

    # 4) enum 타입 정리
    op.execute("DROP TYPE IF EXISTS document_type")
    op.execute("DROP TYPE IF EXISTS package_tier")


def downgrade() -> None:
    # 비파괴 모델로 전환했으므로 다운그레이드는 지원하지 않음.
    # 필요 시 0005, 0016 의 upgrade 본체를 다시 적용해야 함.
    raise NotImplementedError(
        "0019 다운그레이드 미지원 — 패키지 도메인은 전부 제거되었습니다."
    )
