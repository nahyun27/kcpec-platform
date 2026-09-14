from datetime import date, datetime, timezone

MIN_BIRTH_DATE = date(1900, 1, 1)


def validate_birth_date(value: date) -> date:
    """생년월일 상식 범위 검증 — 프런트 <input type="date">는 min/max가 없어도
    개발자도구로 쉽게 우회되고, 값이 수료증/의견서 등 법원 제출용 서류에
    그대로 인쇄된다(2026-09, 버그 감사 중 발견)."""
    today = datetime.now(timezone.utc).date()
    if value < MIN_BIRTH_DATE or value > today:
        raise ValueError("생년월일이 올바르지 않습니다.")
    return value
