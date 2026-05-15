"""packages 가격/포함 서류 + 강의 가격 + DocumentType enum 확장

가격:
  Basic    : 100,000
  Standard : 199,000
  Premium  : 299,000
강의:
  준법의식 강화 → 22,000
  나머지 일반 강의 (id 2~11) → 55,000

Premium 패키지 포함 서류 변경:
  before: certificate, guide, counseling, cbt, consultation
  after : certificate, guide, counseling, cbt,
          petition_sample, reflection_essay, self_reflection_report

document_type enum 에 3개 신규 값 추가:
  petition_sample          탄원서 샘플
  reflection_essay         교육이수 소감문
  self_reflection_report   자기성찰리포트

Revision ID: 0016
Revises: 0015
Create Date: 2026-05-15

"""
from typing import Sequence, Union

from alembic import op


revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_DOC_TYPES = (
    "petition_sample",
    "reflection_essay",
    "self_reflection_report",
)


def upgrade() -> None:
    # PG: ALTER TYPE ADD VALUE 후에는 같은 트랜잭션에서 새 값을 사용할 수 없음.
    # autocommit_block 으로 enum 확장만 별도 commit.
    with op.get_context().autocommit_block():
        for v in NEW_DOC_TYPES:
            op.execute(
                f"ALTER TYPE package_document_type ADD VALUE IF NOT EXISTS '{v}'"
            )

    # ---- 패키지 가격 ----
    op.execute("UPDATE packages SET price = 100000 WHERE tier = 'basic'")
    op.execute("UPDATE packages SET price = 199000 WHERE tier = 'standard'")
    op.execute("UPDATE packages SET price = 299000 WHERE tier = 'premium'")

    # ---- 패키지 설명도 새 가격 / 새 구성에 맞춰 갱신 ----
    op.execute(
        "UPDATE packages SET description = '수료증 단건 발급' WHERE tier = 'basic'"
    )
    op.execute(
        "UPDATE packages "
        "SET description = '수료증 + 심리상담 의견서 + 양형자료 가이드' "
        "WHERE tier = 'standard'"
    )
    op.execute(
        "UPDATE packages "
        "SET description = '수료증 + 심리상담 의견서 + 양형자료 가이드 + "
        "CBT 자료 + 탄원서 샘플 + 교육이수 소감문 + 자기성찰리포트' "
        "WHERE tier = 'premium'"
    )

    # ---- Premium 패키지 documents 재구성 (consultation 제거 + 3종 추가) ----
    op.execute(
        "DELETE FROM package_documents "
        "WHERE document_type = 'consultation' "
        "AND package_id IN (SELECT id FROM packages WHERE tier = 'premium')"
    )
    for doc in NEW_DOC_TYPES:
        op.execute(
            "INSERT INTO package_documents (package_id, document_type) "
            f"SELECT id, '{doc}'::package_document_type "
            "FROM packages WHERE tier = 'premium'"
        )

    # ---- 강의 가격 ----
    op.execute("UPDATE courses SET price = 22000 WHERE title = '준법의식 강화'")
    # 나머지 일반 예방 강의 (id 2~11) — 카테고리는 통합 후 다양해서 id 범위로 지정
    op.execute(
        "UPDATE courses SET price = 55000 "
        "WHERE id BETWEEN 2 AND 11 AND price <> 55000"
    )


def downgrade() -> None:
    # 가격은 이전 값으로 보수적 복원 (원래 NULL 정책이라면 NULL 로 둘 수도 있음).
    op.execute("UPDATE packages SET price = NULL WHERE tier IN ('basic','standard','premium')")
    op.execute(
        "UPDATE packages SET description = '이수증 단건 발급' WHERE tier = 'basic'"
    )
    op.execute(
        "UPDATE packages "
        "SET description = '이수증 + 양형자료 가이드 + 심리상담 의견서' "
        "WHERE tier = 'standard'"
    )
    op.execute(
        "UPDATE packages "
        "SET description = '이수증 + 가이드 + 심리상담 의견서 + CBT 자료 + 1:1 상담' "
        "WHERE tier = 'premium'"
    )

    # Premium documents 원복: 3종 제거 + consultation 재삽입
    for doc in NEW_DOC_TYPES:
        op.execute(
            "DELETE FROM package_documents "
            f"WHERE document_type = '{doc}' "
            "AND package_id IN (SELECT id FROM packages WHERE tier = 'premium')"
        )
    op.execute(
        "INSERT INTO package_documents (package_id, document_type) "
        "SELECT id, 'consultation'::package_document_type "
        "FROM packages WHERE tier = 'premium' "
        "AND NOT EXISTS (SELECT 1 FROM package_documents pd "
        "WHERE pd.package_id = packages.id "
        "AND pd.document_type = 'consultation')"
    )

    # 강의 가격 원복
    op.execute("UPDATE courses SET price = 55000 WHERE title = '준법의식 강화'")
    op.execute("UPDATE courses SET price = 110000 WHERE id BETWEEN 2 AND 11")

    # enum 값은 안전상 제거하지 않음 (PG 에서 enum 값 제거는 까다로움).
