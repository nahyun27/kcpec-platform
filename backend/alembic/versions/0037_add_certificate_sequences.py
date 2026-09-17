"""과정코드별 증서번호 순번 테이블 추가 + 구 사이트 발급 이력 이어받기.

2026-09-17 의뢰인이 구 사이트에서 가장 최근 발급된 증서번호 목록을 전달—
그 다음 번호부터 이어서 발급하기로 확인. 새로 생긴 강의(구 사이트에 없던
과정코드)는 0부터 시작.

Revision ID: 0037
Revises: 0036
Create Date: 2026-09-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0037"
down_revision: Union[str, None] = "0036"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# course_code -> 구 사이트 마지막 발급 번호 + 1 (다음 번호). 목록에 없는
# 코드(새로 생긴 강의)는 1부터.
SEED_NEXT_NUMBER: dict[str, int] = {
    "00": 125,  # 전문가상담(의견서) — 마지막 124
    "10": 242,  # 준법의식 — 241
    "20": 82,  # 음주운전 — 81
    "30": 17,  # 마약 — 16
    "40": 8,  # 학교폭력 — 7
    "50": 124,  # 성범죄 — 123
    "60": 58,  # 성매매 — 57
    "70": 147,  # 디지털 성범죄 — 146
    "80": 20,  # 도박 — 19
    "90": 8,  # 피싱범죄 — 7
    "100": 27,  # 재산범죄 — 26
    "110": 25,  # 스토킹범죄 — 24
}
NEW_COURSE_CODES = [str(n) for n in range(120, 260, 10)]  # 120,130,...,250


def upgrade() -> None:
    op.create_table(
        "certificate_sequences",
        sa.Column("course_code", sa.String(length=10), primary_key=True),
        sa.Column("next_number", sa.Integer(), nullable=False),
    )
    table = sa.table(
        "certificate_sequences",
        sa.column("course_code", sa.String),
        sa.column("next_number", sa.Integer),
    )
    rows = [{"course_code": code, "next_number": n} for code, n in SEED_NEXT_NUMBER.items()]
    rows += [{"course_code": code, "next_number": 1} for code in NEW_COURSE_CODES]
    op.bulk_insert(table, rows)


def downgrade() -> None:
    op.drop_table("certificate_sequences")
