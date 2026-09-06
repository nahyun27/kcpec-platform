import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class IssuedDocumentType(str, enum.Enum):
    CERTIFICATE = "certificate"
    GUIDE = "guide"
    CBT = "cbt"
    COUNSELING = "counseling"


class IssuedDocumentStatus(str, enum.Enum):
    PENDING = "pending"
    READY = "ready"
    # 발급 후 주문이 환불되어 더 이상 유효하지 않은 서류 (법원 제출용이라
    # 환불된 강의의 수료증이 계속 유효한 채로 남아있으면 안 됨).
    REVOKED = "revoked"


class IssuedDocument(Base):
    __tablename__ = "issued_documents"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_type: Mapped[IssuedDocumentType] = mapped_column(
        Enum(
            IssuedDocumentType,
            name="issued_document_type",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
    )
    recipient_name: Mapped[str] = mapped_column(String(100), nullable=False)
    recipient_birth: Mapped[date] = mapped_column(Date, nullable=False)
    # PDF 파일명에 쓰이는 추측 불가능한 랜덤 토큰. /static 은 인증 없이 공개
    # 서빙되므로, id 처럼 순차적인 값으로 파일명을 지으면 누구나 정수를 늘려가며
    # 전체 발급 문서를 스캔/다운로드할 수 있게 된다(2026-09 발견·수정).
    access_token: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    issue_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    status: Mapped[IssuedDocumentStatus] = mapped_column(
        Enum(
            IssuedDocumentStatus,
            name="issued_document_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=IssuedDocumentStatus.PENDING,
    )
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    order: Mapped["Order"] = relationship(back_populates="documents")


from app.models.order import Order  # noqa: E402,F401
