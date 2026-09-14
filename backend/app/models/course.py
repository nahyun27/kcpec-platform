import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CourseCategory(str, enum.Enum):
    """6개 통합 카테고리 + 심리상담.

    이전 11개 카테고리(준법/음주/성범죄/성매매/디지털성범죄/마약/도박/
    피싱/재산범죄/스토킹/학교폭력) 는 alembic 0015 에서 통합됐다.
    """

    SEX_OFFENSE = "성범죄"           # 성범죄/성매매/디지털성범죄
    VIOLENCE = "폭력"                # 학교폭력/스토킹
    PROPERTY_CRIME = "재산범죄"      # 재산범죄/피싱
    DRUG_GAMBLING = "약물·도박"      # 마약/도박
    TRAFFIC = "교통"                 # 음주
    LAW_COMPLIANCE = "준법의식"      # 준법
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
    # 할인 전 정가 — None 이면 할인 표시 안 함. price 보다 클 때만 의미 있음
    # (프론트에서 취소선 정가 + price 로 노출).
    original_price: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    min_progress_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=90)
    quiz_pass_score: Mapped[int] = mapped_column(Integer, nullable=False, default=70)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    lectures: Mapped[list["Lecture"]] = relationship(
        back_populates="course",
        cascade="all, delete-orphan",
        # id 를 2차 정렬 기준으로 둬서, order_index 가 우연히 겹치는 경우에도
        # (정상적으로는 이제 없어야 하지만) 매 조회마다 순서가 흔들리지 않고
        # 항상 같은(생성 순) 순서로 정렬되게 한다 — 이 순서가 순차 잠금
        # 해제/"다음 차시" 판정에 그대로 쓰이기 때문(2026-09, 버그 감사 중
        # order_index 충돌 가능성 발견에 대한 방어적 보강).
        order_by="Lecture.order_index, Lecture.id",
    )
    quiz: Mapped["Quiz | None"] = relationship(
        back_populates="course",
        cascade="all, delete-orphan",
        uselist=False,
    )


# Late imports to register the relationship targets without circular issues.
from app.models.lecture import Lecture  # noqa: E402,F401
from app.models.quiz import Quiz  # noqa: E402,F401
