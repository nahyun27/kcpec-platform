"""토스 상점(MID)별 키 선택.

토스 결제 승인·취소는 결제를 받은 상점의 시크릿 키로만 된다. 그래서 주문을
만들 때 어느 상점으로 받을지 정해 orders.toss_mid 에 적어 두고(승인 후엔
토스가 알려준 실제 mId 로 덮어씀), 승인·환불 때 그 값으로 키를 고른다.
toss_mid 가 비어 있는 주문(기존 주문 전부)은 기본 상점(TOSS_SECRET_KEY) 키.
"""
from app.core.config import settings

# 상담 상점(kcpeca9706)의 BC 카드사 심사가 끝났는지. 끝나기 전엔 상담이 든
# 묶음결제라도 카드는 강의 상점으로 받는다(BC계열이 카드결제의 약 10%,
# 2026-11-15 최근 276건 기준). 토스 상점관리자에서 BC가 "심사승인"이 되면
# True 로 바꾸고 프런트 COUNSELING_CARD_REVIEW_NOTICE 를 false 로.
COUNSELING_STORE_CARD_READY = False


def course_mid() -> str | None:
    """온라인 강의 결제를 받을 상점. 키가 덜 설정됐거나 시뮬레이션 모드면 None
    (= 기본 상점으로 받음)."""
    if settings.TOSS_SECRET_KEY and settings.TOSS_COURSE_SECRET_KEY and settings.TOSS_COURSE_CLIENT_KEY:
        return settings.TOSS_COURSE_MID
    return None


def counseling_mid() -> str | None:
    """심리상담 결제를 받을 상점. 키가 덜 설정됐거나 시뮬레이션 모드면 None
    (= 기본 상점으로 받음)."""
    if (
        settings.TOSS_SECRET_KEY
        and settings.TOSS_COUNSELING_SECRET_KEY
        and settings.TOSS_COUNSELING_CLIENT_KEY
    ):
        return settings.TOSS_COUNSELING_MID
    return None


def secret_key_for_mid(mid: str | None) -> str | None:
    if mid and mid == settings.TOSS_COURSE_MID and settings.TOSS_COURSE_SECRET_KEY:
        return settings.TOSS_COURSE_SECRET_KEY
    if mid and mid == settings.TOSS_COUNSELING_MID and settings.TOSS_COUNSELING_SECRET_KEY:
        return settings.TOSS_COUNSELING_SECRET_KEY
    return settings.TOSS_SECRET_KEY


def client_key_for_mid(mid: str | None) -> str | None:
    """None 이면 프런트가 기본 키(NEXT_PUBLIC_TOSS_CLIENT_KEY)를 쓴다."""
    if mid and mid == settings.TOSS_COURSE_MID:
        return settings.TOSS_COURSE_CLIENT_KEY
    if mid and mid == settings.TOSS_COUNSELING_MID:
        return settings.TOSS_COUNSELING_CLIENT_KEY
    return None
