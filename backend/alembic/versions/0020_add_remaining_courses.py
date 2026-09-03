"""신규 강의 6개 INSERT (is_active=false — 영상 미등록)

25개 시리즈 중 0018(8개)+기존(11개) 이후 남은 마지막 6개.
영상이 준비되면 어드민에서 is_active=true 로 전환.

Revision ID: 0020
Revises: 0019
Create Date: 2026-09-03
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# price 는 최종 할인가 기준으로 갱신됨 (original_price 는 0021에서 컬럼이
# 생기므로 여기선 설정 못 함 — 0024 마이그레이션에서 일괄 채움).
COURSES = [
    ("폭력범죄 예방교육", "폭력", 55000, "폭력범죄의 유형과 처벌 기준 이해 및 재범 방지 과정"),
    ("운전습관·도로교통법 교육", "교통", 55000, "안전운전 습관 형성 및 도로교통법 준수 과정"),
    ("생활예절교육", "준법의식", 22000, "사회생활 예절 및 대인관계 기본 소양 함양 과정"),
    ("공무원 윤리 교육", "준법의식", 33000, "공직자 윤리의식 함양 및 청렴 실천 과정"),
    ("단체·학교 내 윤리 교육", "준법의식", 33000, "단체·학교 조직 내 윤리적 행동 규범 준수 과정"),
    ("명예훼손·모욕 예방 교육", "폭력", 55000, "온·오프라인 명예훼손 및 모욕죄 예방 과정"),
]


def upgrade() -> None:
    for title, cat, price, desc in COURSES:
        op.execute(
            "INSERT INTO courses (title, category, price, is_active, description) "
            f"VALUES ('{title}', '{cat}'::course_category, {price}, false, '{desc}')"
        )


def downgrade() -> None:
    titles = ", ".join(f"'{t}'" for t, *_ in COURSES)
    op.execute(f"DELETE FROM courses WHERE title IN ({titles})")
