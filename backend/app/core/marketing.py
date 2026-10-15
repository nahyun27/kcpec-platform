"""광고성 메일 수신거부 링크 서명 — 로그인 없이 메일의 링크만으로 거부할 수
있어야 하므로 user id 를 HMAC 으로 서명해 위조를 막는다."""

import hashlib
import hmac

from app.core.config import settings


def unsubscribe_token(user_id: int) -> str:
    msg = f"marketing-unsubscribe:{user_id}".encode()
    return hmac.new(settings.JWT_SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()[:32]


def unsubscribe_url(user_id: int) -> str:
    return (
        f"{settings.FRONTEND_BASE_URL}{settings.API_V1_PREFIX}/auth/marketing/unsubscribe"
        f"?u={user_id}&t={unsubscribe_token(user_id)}"
    )


def verify_unsubscribe(user_id: int, token: str) -> bool:
    return hmac.compare_digest(unsubscribe_token(user_id), token)
