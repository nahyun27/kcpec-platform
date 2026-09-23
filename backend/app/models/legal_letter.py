"""반성문·탄원서 — 고객이 직접 쓴 내용을 법원 제출 서식에 채워 즉시 PDF로
발급한다. 심리상담 의견서(AI 초안 + 관리자 검토)와 달리 AI가 글을 새로
쓰지 않고, 관리자 검토 단계도 없다 — 고객이 결제 후 정보를 입력하는 즉시
발급된다.
"""

import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LegalLetterType(str, enum.Enum):
    REPENTANCE = "repentance"  # 반성문
    PETITION = "petition"  # 탄원서


class LegalLetter(Base):
    __tablename__ = "legal_letters"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # 심리상담 결제에 함께 담기는 부가 상품이라, 이 주문 1건당 서식 1건.
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    letter_type: Mapped[LegalLetterType] = mapped_column(
        Enum(
            LegalLetterType,
            name="legal_letter_type",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
    )
    case_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    charge: Mapped[str] = mapped_column(String(200), nullable=False)  # 죄명
    # 사건당사자(피고인) 성명 — 탄원서만 사용(반성문은 작성자 본인이 당사자).
    defendant_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    court_name: Mapped[str] = mapped_column(String(200), nullable=False)  # 관할명(경찰/검찰/법원 등)
    writer_name: Mapped[str] = mapped_column(String(100), nullable=False)
    writer_birth: Mapped[date] = mapped_column(Date, nullable=False)
    # 탄원서는 주소·연락처·사건번호 생략 가능(의뢰인 확정 사항) — 반성문은
    # API 스키마 레벨에서 필수로 강제한다.
    writer_address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    writer_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # 탄원서만 사용 — 사건당사자와의 관계.
    relationship_to_defendant: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # 반성문 전용 선택사항 — AI 프롬프트 재료.
    first_offense: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    prior_same_type_record: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    case_stage: Mapped[str | None] = mapped_column(String(50), nullable=True)
    settlement_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # 자유 서술 질문 답변 원본(JSON 문자열) — AI 프롬프트 재료이자 감사·재생성
    # 대비 기록.
    structured_answers: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 서식에 실제로 들어가는 본문 — AI가 답변을 바탕으로 작성한 결과물.
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # PDF 파일명에 쓰는 추측 불가능한 토큰 — /static 공개 서빙 대비(기존 관례와 동일).
    access_token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    pdf_url: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
