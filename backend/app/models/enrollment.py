from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("user_id", "course_id", name="uq_enrollments_user_course"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    enrolled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # 결제 시점(_ensure_enrollment)에 enrolled_at + ENROLLMENT_ACCESS_DAYS 로 설정.
    # None 이면 기간 제한 없음(레거시 데이터 등) — 신규 enrollment 는 항상 채워짐.
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    progresses: Mapped[list["LectureProgress"]] = relationship(
        back_populates="enrollment",
        cascade="all, delete-orphan",
    )


class LectureProgress(Base):
    __tablename__ = "lecture_progress"
    __table_args__ = (
        UniqueConstraint("enrollment_id", "lecture_id", name="uq_lecture_progress_enrollment_lecture"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    enrollment_id: Mapped[int] = mapped_column(
        ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lecture_id: Mapped[int] = mapped_column(
        ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    watched_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_position_sec: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    enrollment: Mapped["Enrollment"] = relationship(back_populates="progresses")
