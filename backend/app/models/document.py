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
