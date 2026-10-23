"""토스 상점(MID)별 키 선택.

토스 결제 승인·취소는 결제를 받은 상점의 시크릿 키로만 된다. 그래서 주문을
만들 때 어느 상점으로 받을지 정해 orders.toss_mid 에 적어 두고(승인 후엔
토스가 알려준 실제 mId 로 덮어씀), 승인·환불 때 그 값으로 키를 고른다.
toss_mid 가 비어 있는 주문(기존 주문 전부)은 기본 상점(TOSS_SECRET_KEY) 키.
"""
from app.core.config import settings


def course_mid() -> str | None:
    """온라인 강의 결제를 받을 상점. 키가 덜 설정됐거나 시뮬레이션 모드면 None
    (= 기본 상점으로 받음)."""
    if settings.TOSS_SECRET_KEY and settings.TOSS_COURSE_SECRET_KEY and settings.TOSS_COURSE_CLIENT_KEY:
        return settings.TOSS_COURSE_MID
    return None


def secret_key_for_mid(mid: str | None) -> str | None:
    if mid and mid == settings.TOSS_COURSE_MID and settings.TOSS_COURSE_SECRET_KEY:
        return settings.TOSS_COURSE_SECRET_KEY
    return settings.TOSS_SECRET_KEY


def client_key_for_mid(mid: str | None) -> str | None:
    """None 이면 프런트가 기본 키(NEXT_PUBLIC_TOSS_CLIENT_KEY)를 쓴다."""
    if mid and mid == settings.TOSS_COURSE_MID:
        return settings.TOSS_COURSE_CLIENT_KEY
    return None
