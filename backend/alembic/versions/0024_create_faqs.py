"""create faqs table + seed 기존 하드코딩 FAQ 8개

지금까지 자주 묻는 질문이 frontend/src/app/page.tsx 와
frontend/src/app/(main)/community/_client.tsx 두 곳에 각각 하드코딩된
배열로 중복 존재했고, 관리자 콘솔에서는 편집할 방법이 전혀 없었다
(사이드바에 "FAQ" 메뉴가 있었지만 실제로는 아무 것도 안 됨). 이 두
하드코딩 목록을 이 테이블 하나로 통합하고, 기존 문구를 그대로
초기 데이터로 심는다.

Revision ID: 0024
Revises: 0023
Create Date: 2026-09-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


FAQ_CATEGORIES = ("docs", "refund", "counseling", "etc")

# (category, question, answer) — community/_client.tsx 의 기존 FAQ_ITEMS 순서 그대로.
SEED_FAQS: list[tuple[str, str, str]] = [
    (
        "docs",
        "수료증 또는 상담의견서 등은 언제 어떻게 받을 수 있나요?",
        "수강자가 강의를 수강한 내역이 확인되면 익일 24시까지 가입하신 이메일을 통해 pdf파일로 보내드립니다.\n"
        "상담의견서는 상담 후 24시간 이내에 가입하신 이메일을 통해 pdf파일로 보내드립니다.",
    ),
    (
        "docs",
        "수료증을 재발급 받을 수 있나요?",
        "수료증을 재발급 받기 위해서는 법령에 따른 개인정보 보관 기간 내에 admin@kcpec.co.kr 이메일로 문의주시면 "
        "1회에 한하여 재발급해드립니다.",
    ),
    (
        "refund",
        "환불 및 취소가 가능한가요?",
        "결제 오류에 대한 환불이나 취소는 가능하나, 강의 수강 시작 후 또는 상담 의뢰 후 환불이나 취소는 불가합니다.",
    ),
    (
        "counseling",
        "상담 절차는 어떻게 진행되나요?",
        "기본 상담 절차는 이용자가 상담 설문지를 작성하여 제출하는 서면상담 방식으로 진행됩니다.\n"
        "심화상담은 의뢰를 하실 경우 상담사와 일정을 맞춘 후 상담사가 해당 시간에 이용자에게 전화를 드리거나 "
        "대면상담을 진행합니다.\n"
        "모든 상담이 종료된 후 24시간 이내에 상담의견서 등을 pdf파일로 가입하신 이메일로 보내드립니다.",
    ),
    (
        "docs",
        "발급받은 서류를 법원이나 수사기관에 제출해도 되나요?",
        "네, 저희 센터에서 발급한 수료증, 상담 의견서, 서약서 등 자료는 법원이나 수사기관, 학교 등 공공기관에 "
        "제출하셔도 됩니다.",
    ),
    (
        "etc",
        "양형자료만 내면 무조건 감형이 되는 건가요?",
        "그렇지 않습니다. 검찰이나 법원의 양형판단은 다양한 요소들을 바탕으로 종합적으로 이루어지기 때문입니다.\n"
        "다만 수료증, 상담 의견서 등 양형자료는 재범예방교육 또는 심리상담을 통해 피고인(또는 피의자)이 재범하지 "
        "않을 것을 굳게 다짐하고 있다는 사정을 경찰, 검찰이나 법원에 알리는 효과적인 방법이 될 수 있습니다.",
    ),
    (
        "docs",
        "발급받은 서류의 진위 확인이 가능한가요?",
        "네 가능합니다. 저희 센터에서 발급하는 서류는 워터마크가 삽입되어 있으며 문서일련번호로 진위 확인이 "
        "가능합니다.\n"
        "서류의 진위확인을 원하시는 경우, 서류 사본과 문의하실 내용을 적어 admin@kcpec.co.kr로 이메일 문의를 "
        "주시면 답변드립니다.",
    ),
    (
        "etc",
        "사건에 대한 변호사 상담을 받을 수 있나요?",
        "본 센터는 변호사 소개나 알선, 상담을 제공하지 않습니다.",
    ),
]


def upgrade() -> None:
    faq_category = sa.Enum(*FAQ_CATEGORIES, name="faq_category")

    op.create_table(
        "faqs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("category", faq_category, nullable=False),
        sa.Column("question", sa.String(length=500), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_faqs_category", "faqs", ["category"])

    faqs_table = sa.table(
        "faqs",
        sa.column("category", sa.String),
        sa.column("question", sa.String),
        sa.column("answer", sa.Text),
        sa.column("order_index", sa.Integer),
    )
    op.bulk_insert(
        faqs_table,
        [
            {"category": cat, "question": q, "answer": a, "order_index": idx}
            for idx, (cat, q, a) in enumerate(SEED_FAQS, start=1)
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_faqs_category", table_name="faqs")
    op.drop_table("faqs")
    bind = op.get_bind()
    sa.Enum(name="faq_category").drop(bind, checkfirst=True)
