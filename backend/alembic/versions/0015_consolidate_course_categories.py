"""consolidate course categories — 11개 → 6개 통합

기존:
  준법, 음주, 성범죄, 성매매, 디지털성범죄, 마약, 도박, 피싱,
  재산범죄, 스토킹, 학교폭력, 심리상담
신규:
  성범죄(+성매매+디지털성범죄), 폭력(학교폭력+스토킹),
  재산범죄(+피싱), 약물·도박(마약+도박), 교통(음주),
  준법의식(준법), 심리상담(그대로)

review 게시글의 course_category(text) 도 새 카테고리로 동기화한다.
이 마이그레이션은 0014 가 적용된 상태(=review post 들이 course_id
를 가진 상태)를 가정한다.

Revision ID: 0015
Revises: 0014
Create Date: 2026-05-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_VALUES = ("성범죄", "폭력", "재산범죄", "약물·도박", "교통", "준법의식", "심리상담")
OLD_VALUES = (
    "준법", "음주", "성범죄", "성매매", "디지털성범죄", "마약", "도박",
    "피싱", "재산범죄", "스토킹", "학교폭력", "심리상담",
)


def upgrade() -> None:
    # 1. courses.category enum → text 로 풀고 enum 타입 drop
    op.execute("ALTER TABLE courses ALTER COLUMN category TYPE varchar(50) USING category::text")
    op.execute("DROP TYPE course_category")

    # 2. courses.category 데이터 매핑
    op.execute("UPDATE courses SET category = '성범죄' WHERE category IN ('성범죄', '성매매', '디지털성범죄')")
    op.execute("UPDATE courses SET category = '폭력' WHERE category IN ('학교폭력', '스토킹')")
    op.execute("UPDATE courses SET category = '재산범죄' WHERE category IN ('재산범죄', '피싱')")
    op.execute("UPDATE courses SET category = '약물·도박' WHERE category IN ('마약', '도박')")
    op.execute("UPDATE courses SET category = '교통' WHERE category = '음주'")
    op.execute("UPDATE courses SET category = '준법의식' WHERE category = '준법'")
    # 심리상담 — 그대로 유지

    # 3. 기존 review 포스트의 course_category 를 강의 category 와 동기화
    op.execute(
        """
        UPDATE posts
        SET course_category = courses.category
        FROM courses
        WHERE posts.category = 'review' AND posts.course_id = courses.id
        """
    )

    # 4. 새 enum 타입 생성 + 컬럼 다시 enum 화
    new_enum = sa.Enum(*NEW_VALUES, name="course_category")
    new_enum.create(op.get_bind(), checkfirst=False)
    op.execute(
        "ALTER TABLE courses ALTER COLUMN category TYPE course_category USING category::course_category"
    )


def downgrade() -> None:
    # 통합으로 인해 정보 손실이 있어 완전한 복원은 불가.
    # 가장 보수적인 매핑으로 되돌리고, 원래 11개 enum 을 재생성한다.
    op.execute("ALTER TABLE courses ALTER COLUMN category TYPE varchar(50) USING category::text")
    op.execute("DROP TYPE course_category")

    # 통합된 카테고리 → 원래 카테고리 중 대표값으로 되돌림 (정확성 보장 X)
    op.execute("UPDATE courses SET category = '성범죄' WHERE category = '성범죄'")  # no-op (대표값)
    op.execute("UPDATE courses SET category = '학교폭력' WHERE category = '폭력'")
    op.execute("UPDATE courses SET category = '재산범죄' WHERE category = '재산범죄'")  # no-op
    op.execute("UPDATE courses SET category = '마약' WHERE category = '약물·도박'")
    op.execute("UPDATE courses SET category = '음주' WHERE category = '교통'")
    op.execute("UPDATE courses SET category = '준법' WHERE category = '준법의식'")

    old_enum = sa.Enum(*OLD_VALUES, name="course_category")
    old_enum.create(op.get_bind(), checkfirst=False)
    op.execute(
        "ALTER TABLE courses ALTER COLUMN category TYPE course_category USING category::course_category"
    )
