"""issued_documents / counseling_surveys 에 access_token 추가.

/static 이 인증 없이 전체 공개 서빙되는데, PDF/초안 파일명이 지금까지
id(순차 정수)를 그대로 썼음 — 즉 누구나 URL의 정수를 1부터 늘려가며
전체 수료증·심리상담 의견서·설문 원문을 스캔/다운로드할 수 있었음
(실명·생년월일·심리상담 내용 등 민감정보 유출). 파일명을 이 랜덤
토큰으로 바꿔 추측/스캔이 불가능하게 한다.

기존 행은 소급 적용하지 않음(NULL) — 이 시점 기준 로컬 개발 데이터
뿐이라 실사용자 영향 없음. 신규 발급분부터 토큰이 채워짐.

Revision ID: 0023
Revises: 0022
Create Date: 2026-09-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0023"
down_revision: Union[str, None] = "0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "issued_documents", sa.Column("access_token", sa.String(length=64), nullable=True)
    )
    op.create_unique_constraint(
        "uq_issued_documents_access_token", "issued_documents", ["access_token"]
    )
    op.add_column(
        "counseling_surveys", sa.Column("access_token", sa.String(length=64), nullable=True)
    )
    op.create_unique_constraint(
        "uq_counseling_surveys_access_token", "counseling_surveys", ["access_token"]
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_counseling_surveys_access_token", "counseling_surveys", type_="unique"
    )
    op.drop_column("counseling_surveys", "access_token")
    op.drop_constraint(
        "uq_issued_documents_access_token", "issued_documents", type_="unique"
    )
    op.drop_column("issued_documents", "access_token")
