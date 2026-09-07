"""로그인 세션을 httpOnly 쿠키로 관리.

기존에는 access/refresh JWT 를 응답 body 로 그대로 내려줘서 프런트가
localStorage 에 저장했는데, 그러면 XSS 한 방에 토큰이 통째로 털린다.
쿠키는 httponly 라 JS 에서 아예 읽을 수 없어 그 경로가 막힌다.
"""

from __future__ import annotations

from fastapi import Request, Response

from app.core.config import settings
from app.schemas.auth import TokenResponse

ACCESS_COOKIE = "kcpec_access"
REFRESH_COOKIE = "kcpec_refresh"

# refresh 쿠키는 /auth 경로에만 실려가도록 제한 — 다른 모든 API 호출에
# 굳이 장기 유효 토큰을 매번 딸려 보낼 필요가 없다 (노출 표면 최소화).
_REFRESH_PATH = f"{settings.API_V1_PREFIX}/auth"


def set_auth_cookies(response: Response, tokens: TokenResponse) -> None:
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=tokens.access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=tokens.refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        path=_REFRESH_PATH,
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path=_REFRESH_PATH)


def get_access_token(request: Request) -> str | None:
    return request.cookies.get(ACCESS_COOKIE)


def get_refresh_token(request: Request) -> str | None:
    return request.cookies.get(REFRESH_COOKIE)
