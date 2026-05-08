import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class NoticeCategory(str, enum.Enum):
    NOTICE = "notice"      # 공지사항
    RESOURCE = "resource"  # 자료실


class PostCategory(str, enum.Enum):
    QNA = "qna"        # 질문답변
    COLUMN = "column"  # 전문가 칼럼 (관리자 전용)
    REVIEW = "review"  # 수강 후기


class Notice(Base):
    __tablename__ = "notices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[NoticeCategory] = mapped_column(
        Enum(
            NoticeCategory,
            name="notice_category",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        index=True,
    )
    author_name: Mapped[str] = mapped_column(
        String(50), nullable=False, default="한국범죄예방교육센터"
    )
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[PostCategory] = mapped_column(
        Enum(
            PostCategory,
            name="post_category",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        index=True,
    )
    author_name: Mapped[str] = mapped_column(String(50), nullable=False, default="익명")
    course_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 관리자 답변 (Q&A 전용 — 다른 카테고리에선 항상 None)
    admin_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
