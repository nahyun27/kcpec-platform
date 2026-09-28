"""반성문·탄원서 — 고객이 결제 후 질문에 답하면 AI(Gemini)가 답변을 바탕으로
본문을 작성한다. 심리상담 의견서와 마찬가지로 관리자 검토를 거친 뒤 발급된다 —
고객 제출 시점에는 AI 초안(content)만 만들어지고, 관리자가 검토·필요시
재생성/직접 수정 → 워드로 다운로드해 서명 위치 등을 다듬은 뒤 → 그 결과물
(PDF)을 직접 업로드해야 고객에게 공개된다(released_at 이 그 시점, 2026-09 —
처음엔 관리자가 텍스트만 수정하면 서버가 자동으로 PDF까지 만드는 "발급 확정"
버튼 하나였으나, 법원 제출 서류라 워드에서 직접 다듬을 수 있어야 한다는
요청으로 심리상담 의견서와 동일한 방식으로 변경).
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
    # 서식에 실제로 들어가는 본문 — AI가 답변을 바탕으로 작성한 결과물. 관리자가
    # "다시 생성"을 누르면 이 값이 새 AI 결과로 교체되고, 직접 수정도 가능하다.
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # PDF 파일명에 쓰는 추측 불가능한 토큰 — /static 공개 서빙 대비(기존 관례와 동일).
    # 관리자가 최종 PDF 를 업로드하는 시점에만 값이 생긴다(그 전엔 PDF 자체가 없음).
    access_token: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # 관리자가 최종 PDF 를 업로드한 시각 — None 이면 아직 검토 대기 중이라
    # 고객에게 pdf_url 을 보여주지 않는다.
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
