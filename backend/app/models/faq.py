import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class FaqCategory(str, enum.Enum):
    DOCS = "docs"              # 수료증·서류
    REFUND = "refund"          # 환불·취소
    COUNSELING = "counseling"  # 상담
    ETC = "etc"                # 기타


class Faq(Base):
    __tablename__ = "faqs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    category: Mapped[FaqCategory] = mapped_column(
        Enum(
            FaqCategory,
            name="faq_category",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        index=True,
    )
    question: Mapped[str] = mapped_column(String(500), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
