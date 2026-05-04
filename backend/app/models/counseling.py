import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CounselingStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    DRAFT_GENERATED = "draft_generated"
    SENT_TO_STAFF = "sent_to_staff"
    COMPLETED = "completed"


class CounselingSurvey(Base):
    __tablename__ = "counseling_surveys"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    responses: Mapped[dict] = mapped_column(JSONB, nullable=False)

    ai_draft_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    draft_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    final_pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    status: Mapped[CounselingStatus] = mapped_column(
        Enum(
            CounselingStatus,
            name="counseling_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=CounselingStatus.SUBMITTED,
        index=True,
    )

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
