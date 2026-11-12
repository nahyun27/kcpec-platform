"""광고비 관리(2026-11) — 대행사 월간 리포트 업로드 + 월 단위 직접 입력.

매출 통계(admin_sales_stats)가 여기 쌓인 값으로 광고비·ROAS 를 같이 보여준다.
"""

from __future__ import annotations

import io
import re
from collections import defaultdict
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.admin import require_admin
from app.core.database import get_db
from app.models.ad_spend import AdSpend

router = APIRouter(
    prefix="/admin/ad-spend",
    tags=["admin-ad-spend"],
    dependencies=[Depends(require_admin)],
)

CHANNEL_LABEL = {
    "naver": "네이버",
    "google": "구글",
    "kakao": "카카오",
    "meta": "메타(인스타·페북)",
    "other": "기타",
}


def _num(v) -> int | None:
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, (int, float)):
        return int(round(v))
    if isinstance(v, str):
        s = v.replace(",", "").strip()
        if re.fullmatch(r"-?\d+(\.\d+)?", s):
            return int(round(float(s)))
    return None


def parse_agency_report(content: bytes) -> list[dict]:
    """대행사 월간 리포트 xlsx → 광고비 행 목록.

    시트 이름이 NAVER / GOOGLE 처럼 매체명인 요약 시트에서
    "▣ 일자별 광고요약"(날짜별)과 "▣ (YYYY) 월별 광고요약"(월별) 표를 읽는다.
    """
    import openpyxl

    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"엑셀 파일을 읽지 못했습니다: {e}") from e

    rows_out: list[dict] = []
    for ws in wb.worksheets:
        title = ws.title.strip().lower()
        channel = next((c for c in ("naver", "google", "kakao", "meta") if title == c), None)
        if channel is None:
            continue
        mode: str | None = None
        year: int | None = None
        cols: dict[str, int] = {}
        for row in ws.iter_rows(values_only=True):
            cells = list(row)
            texts = [c.strip() if isinstance(c, str) else c for c in cells]
            joined = " ".join(t for t in texts if isinstance(t, str))
            if "▣" in joined and "일자별 광고요약" in joined:
                mode, cols = "day", {}
                continue
            m = re.search(r"▣\s*\((\d{4})\)\s*월별 광고요약", joined)
            if m:
                mode, cols, year = "month", {}, int(m.group(1))
                continue
            if "▣" in joined:
                mode = None
                continue
            if mode is None:
                continue
            if "총광고비" in texts:
                cols = {name: texts.index(name) for name in ("노출수", "클릭수", "총광고비") if name in texts}
                cols["key"] = texts.index("날짜") if "날짜" in texts else texts.index("구분") if "구분" in texts else -1
                continue
            if not cols or cols.get("key", -1) < 0:
                continue
            key = cells[cols["key"]]
            cost = _num(cells[cols["총광고비"]]) if "총광고비" in cols else None
            if cost is None or cost <= 0:
                continue
            imp = _num(cells[cols["노출수"]]) if "노출수" in cols else None
            clk = _num(cells[cols["클릭수"]]) if "클릭수" in cols else None
            if mode == "day" and isinstance(key, datetime):
                rows_out.append(
                    dict(channel=channel, day=key.date(), granularity="day", cost=cost, impressions=imp, clicks=clk)
                )
            elif mode == "month" and year and isinstance(key, str):
                mm = re.fullmatch(r"(\d{1,2})월", key.strip())
                if mm:
                    rows_out.append(
                        dict(
                            channel=channel,
                            day=date(year, int(mm.group(1)), 1),
                            granularity="month",
                            cost=cost,
                            impressions=imp,
                            clicks=clk,
                        )
                    )
    return rows_out


def _guess_year(month: int) -> int:
    """리포트에 연도가 없을 때 — 올해 기준, 아직 안 온 달이면 작년."""
    from datetime import timedelta, timezone

    today = datetime.now(timezone(timedelta(hours=9))).date()
    return today.year if month <= today.month + 1 else today.year - 1


def parse_weekly_report(content: bytes) -> list[dict]:
    """대행사 주간 리포트 xlsx → 하루 단위로 나눈 광고비(granularity="wday").

    "총비용 10/26~11/1" 같은 기간 머리글과 "전체 RAW 합계" 줄을 찾아 주별 총액을
    읽고, 그 기간의 날짜 수로 고르게 나눠 날짜별 행으로 만든다(달이 걸치는 주를
    월별로 정확히 나누기 위해). 매체는 네이버로 본다(현재 리포트가 네이버 검색광고).
    """
    import openpyxl
    from datetime import timedelta

    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"엑셀 파일을 읽지 못했습니다: {e}") from e
    out: list[dict] = []
    seen: set[tuple[date, date]] = set()
    for ws in wb.worksheets:
        cost_cols: dict[int, tuple[date, date]] = {}
        click_cols: dict[tuple[date, date], int] = {}
        imp_cols: dict[tuple[date, date], int] = {}
        for row in ws.iter_rows(values_only=True):
            cells = list(row)
            found = False
            for i, v in enumerate(cells):
                if not isinstance(v, str):
                    continue
                m = re.fullmatch(r"(총비용|클릭|노출)\s+(\d{1,2})/(\d{1,2})\s*~\s*(\d{1,2})/(\d{1,2})", v.strip())
                if not m:
                    continue
                found = True
                m1, d1, m2, d2 = map(int, m.groups()[1:])
                y1 = _guess_year(m1)
                y2 = y1 + 1 if m2 < m1 else y1
                period = (date(y1, m1, d1), date(y2, m2, d2))
                if m.group(1) == "총비용":
                    cost_cols[i] = period
                elif m.group(1) == "클릭":
                    click_cols[period] = i
                else:
                    imp_cols[period] = i
            if found:
                continue
            first = next((c for c in cells if c is not None), None)
            if cost_cols and isinstance(first, str) and "합계" in first:
                for ci, period in cost_cols.items():
                    if period in seen:
                        continue
                    cost = _num(cells[ci])
                    if cost is None or cost <= 0:
                        continue
                    seen.add(period)
                    start, end = period
                    n = (end - start).days + 1
                    if n <= 0 or n > 31:
                        continue
                    imp = _num(cells[imp_cols[period]]) if period in imp_cols else None
                    clk = _num(cells[click_cols[period]]) if period in click_cols else None
                    base = cost // n
                    for k in range(n):
                        d = start + timedelta(days=k)
                        out.append(
                            dict(
                                channel="naver",
                                day=d,
                                granularity="wday",
                                cost=base + (cost - base * n if k == n - 1 else 0),
                                # 노출·클릭은 첫날에 몰아서 기록(합계만 의미 있음)
                                impressions=imp if k == 0 else None,
                                clicks=clk if k == 0 else None,
                            )
                        )
                cost_cols = {}
    return out


def _upsert(db: Session, r: dict, source: str) -> None:
    existing = db.scalar(
        select(AdSpend).where(
            AdSpend.channel == r["channel"],
            AdSpend.day == r["day"],
            AdSpend.granularity == r["granularity"],
        )
    )
    if existing is None:
        db.add(AdSpend(**r, source=source))
    else:
        existing.cost = r["cost"]
        existing.impressions = r.get("impressions")
        existing.clicks = r.get("clicks")
        existing.source = source


def monthly_ad_cost(db: Session, start: date | None = None, end: date | None = None) -> dict[str, dict[str, int]]:
    """{ "YYYY-MM": {channel: cost} } — 일자별 기록이 있는 달은 그 합계, 없으면 월 합계."""
    q = select(AdSpend)
    if start is not None:
        q = q.where(AdSpend.day >= start)
    if end is not None:
        q = q.where(AdSpend.day < end)
    # 우선순위: 월간 리포트 일자별(day) > 월 합계(month) > 주간 리포트 환산(wday)
    sums: dict[str, dict[tuple[str, str], int]] = {"day": defaultdict(int), "month": defaultdict(int), "wday": defaultdict(int)}
    for a in db.scalars(q).all():
        sums.setdefault(a.granularity, defaultdict(int))[(a.day.strftime("%Y-%m"), a.channel)] += a.cost
    out: dict[str, dict[str, int]] = defaultdict(dict)
    for gran in ("wday", "month", "day"):
        for (ym, ch), v in sums[gran].items():
            out[ym][ch] = v
    return out


def daily_ad_cost(db: Session, start: date, end: date) -> dict[str, int]:
    """{ "YYYY-MM-DD": cost } — 일자별 기록(없는 날은 주간 리포트 환산값). 월 합계만 있는 달은 제외."""
    rows = db.scalars(
        select(AdSpend).where(
            AdSpend.granularity.in_(("day", "wday")), AdSpend.day >= start, AdSpend.day < end
        )
    ).all()
    has_day = {(a.day.strftime("%Y-%m"), a.channel) for a in rows if a.granularity == "day"}
    out: dict[str, int] = defaultdict(int)
    for a in rows:
        if a.granularity == "wday" and (a.day.strftime("%Y-%m"), a.channel) in has_day:
            continue
        out[a.day.isoformat()] += a.cost
    return out


class AdSpendMonthRow(BaseModel):
    month: str
    channel: str
    channel_label: str
    cost: int
    impressions: int | None
    clicks: int | None
    has_daily: bool
    from_weekly: bool = False
    source: str


@router.get("", response_model=list[AdSpendMonthRow])
def list_ad_spend(db: Session = Depends(get_db)) -> list[AdSpendMonthRow]:
    agg: dict[tuple[str, str], dict] = {}
    rows = db.scalars(select(AdSpend).order_by(AdSpend.day)).all()
    grans: dict[tuple[str, str], set[str]] = defaultdict(set)
    for a in rows:
        grans[(a.day.strftime("%Y-%m"), a.channel)].add(a.granularity)
    daily_keys = {k for k, g in grans.items() if "day" in g}

    def chosen(g: set[str]) -> str:
        return "day" if "day" in g else "month" if "month" in g else "wday"

    for a in rows:
        key = (a.day.strftime("%Y-%m"), a.channel)
        if a.granularity != chosen(grans[key]):
            continue
        cur = agg.setdefault(
            key, dict(cost=0, impressions=0, clicks=0, has_imp=False, sources=set())
        )
        cur["cost"] += a.cost
        if a.impressions is not None:
            cur["impressions"] += a.impressions
            cur["has_imp"] = True
        if a.clicks is not None:
            cur["clicks"] += a.clicks
        cur["sources"].add(a.source)
    return [
        AdSpendMonthRow(
            month=ym,
            channel=ch,
            channel_label=CHANNEL_LABEL.get(ch, ch),
            cost=v["cost"],
            impressions=v["impressions"] if v["has_imp"] else None,
            clicks=v["clicks"] if v["has_imp"] else None,
            has_daily=(ym, ch) in daily_keys,
            from_weekly=chosen(grans[(ym, ch)]) == "wday",
            source="upload" if "upload" in v["sources"] else "manual",
        )
        for (ym, ch), v in sorted(agg.items(), reverse=True)
    ]


class UploadResult(BaseModel):
    imported_days: int
    imported_months: int
    months: list[str]
    total_cost: int


@router.post("/upload", response_model=UploadResult)
async def upload_agency_report(
    file: UploadFile = File(...), db: Session = Depends(get_db)
) -> UploadResult:
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="파일이 너무 큽니다(10MB 이하).")
    rows = parse_agency_report(content) or parse_weekly_report(content)
    if not rows:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="광고비를 찾지 못했습니다. 대행사 월간 리포트(NAVER 시트) 또는 주간 리포트(총비용·전체 RAW 합계) 형식인지 확인해 주세요.",
        )
    for r in rows:
        _upsert(db, r, "upload")
    db.commit()
    days = [r for r in rows if r["granularity"] in ("day", "wday")]
    months = sorted({r["day"].strftime("%Y-%m") for r in rows})
    by_month = monthly_ad_cost(db)
    return UploadResult(
        imported_days=len(days),
        imported_months=len(rows) - len(days),
        months=months,
        total_cost=sum(sum(by_month.get(m, {}).values()) for m in months),
    )


class ManualMonthInput(BaseModel):
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    channel: str = Field(min_length=1, max_length=30)
    cost: int = Field(ge=0)


@router.put("/month", response_model=list[AdSpendMonthRow])
def set_month_cost(body: ManualMonthInput, db: Session = Depends(get_db)) -> list[AdSpendMonthRow]:
    """월 광고비 직접 입력(리포트가 없는 매체용). 0원이면 그 달 입력값을 지운다."""
    y, m = map(int, body.month.split("-"))
    day = date(y, m, 1)
    if body.cost == 0:
        for a in db.scalars(
            select(AdSpend).where(
                AdSpend.channel == body.channel, AdSpend.day == day, AdSpend.granularity == "month"
            )
        ).all():
            db.delete(a)
    else:
        _upsert(
            db,
            dict(channel=body.channel, day=day, granularity="month", cost=body.cost, impressions=None, clicks=None),
            "manual",
        )
    db.commit()
    return list_ad_spend(db)
