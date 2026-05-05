import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CourseCategory(str, enum.Enum):
    LAW_COMPLIANCE = "준법"
    DRUNK_DRIVING = "음주"
    SEX_OFFENSE = "성범죄"
    PROSTITUTION = "성매매"
    DIGITAL_SEX_OFFENSE = "디지털성범죄"
    DRUG = "마약"
    GAMBLING = "도박"
    PHISHING = "피싱"
    PROPERTY_CRIME = "재산범죄"
    STALKING = "스토킹"
    SCHOOL_VIOLENCE = "학교폭력"
    # 전문가 심리상담 프로그램(독립 구매) 도 Course 행으로 등록되며 이 카테고리를 사용.
    COUNSELING = "심리상담"


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[CourseCategory] = mapped_column(
        Enum(CourseCategory, name="course_category", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        index=True,
    )
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # 심리상담 "별도 문의" 프로그램의 경우 None.
    price: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    min_progress_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=90)
    quiz_pass_score: Mapped[int] = mapped_column(Integer, nullable=False, default=70)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    lectures: Mapped[list["Lecture"]] = relationship(
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="Lecture.order_index",
    )
    quiz: Mapped["Quiz | None"] = relationship(
        back_populates="course",
        cascade="all, delete-orphan",
        uselist=False,
    )


# Late imports to register the relationship targets without circular issues.
from app.models.lecture import Lecture  # noqa: E402,F401
from app.models.quiz import Quiz  # noqa: E402,F401
