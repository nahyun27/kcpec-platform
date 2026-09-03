"""신규 강의 8개 INSERT (is_active=false — 영상 미등록)

/sentencing 큐레이션에서 죄명별 추가 추천에 사용.
영상이 준비되면 어드민에서 is_active=true 로 전환.

Revision ID: 0018
Revises: 0017
Create Date: 2026-05-21
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# price 는 최종 할인가 기준으로 갱신됨 (original_price 는 0021에서 컬럼이
# 생기므로 여기선 설정 못 함 — 0024 마이그레이션에서 일괄 채움).
COURSES = [
    ("분노 조절·감정 통제 교육", "폭력", 22000, "분노 조절 및 감정 통제 훈련 과정"),
    ("알코올·중독 습관 교정 교육", "교통", 22000, "단주 습관 교정 및 금주 실천 과정"),
    ("비즈니스·직장 내 윤리 교육", "준법의식", 33000, "직장 내 괴롭힘 예방 및 건전한 조직문화 과정"),
    ("경제 관념·사행성 방지 교육", "재산범죄", 22000, "준법 경제 윤리 및 불법 사행성 근절 과정"),
    ("디지털 저작권·정보통신 윤리 교육", "재산범죄", 33000, "정보통신준법 및 디지털 저작권 보호 과정"),
    ("개인정보 보호·사이버 금융 범죄 예방", "재산범죄", 33000, "개인정보보호 준수 및 사이버 금융 범죄 근절 과정"),
    ("청소년범죄예방교육", "폭력", 55000, "소년 준법의식 함양 및 재범 방지 과정"),
    ("보호자 양육 윤리·예방 교육", "폭력", 33000, "아동 권리 존중 및 가정 내 올바른 훈육 과정"),
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
