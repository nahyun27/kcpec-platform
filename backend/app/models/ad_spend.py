"""광고비(2026-11) — 매출 통계에서 광고비·ROAS 를 같이 보기 위한 기록.

대행사 월간 리포트(xlsx)를 올리면 일자별·월별 광고비를 읽어 넣고, 리포트가
없는 매체는 관리자가 월 단위로 직접 입력한다. 한 매체·한 달에 일자별 기록이
있으면 그 달의 월 합계 행은 무시한다(같은 돈을 두 번 세지 않게).
"""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AdSpend(Base):
    __tablename__ = "ad_spend"
    __table_args__ = (
        UniqueConstraint("channel", "day", "granularity", name="uq_ad_spend_channel_day_gran"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    channel: Mapped[str] = mapped_column(String(30), nullable=False, index=True)  # naver, google, ...
    # granularity=day 면 그 날짜, month 면 그 달 1일
    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    granularity: Mapped[str] = mapped_column(String(10), nullable=False)  # "day" | "month"
    cost: Mapped[int] = mapped_column(Integer, nullable=False)
    impressions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    clicks: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")  # upload | manual
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
