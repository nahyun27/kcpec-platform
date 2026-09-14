import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TokenType = Literal["access", "refresh"]


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_lookup_token(raw_token: str) -> str:
    """비밀번호 재설정/이메일 인증 토큰을 DB에 저장하기 전 해시.

    이 토큰들은 이미 secrets.token_urlsafe(32)로 추측 불가능하지만, 평문
    그대로 저장하면 DB 덤프가 유출됐을 때 그 자체로 바로 재사용 가능한
    유효한 토큰이 된다 — 비밀번호 해시처럼 원문을 저장하지 않는다
    (2026-09, 버그 감사 중 발견). 사용자에게 보내는 링크에는 원문을,
    DB 조회에는 이 해시값을 쓴다.
    """
    return hashlib.sha256(raw_token.encode()).hexdigest()


def _create_token(subject: str | int, token_type: TokenType, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(subject: str | int) -> str:
    return _create_token(
        subject,
        "access",
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(subject: str | int) -> str:
    return _create_token(
        subject,
        "refresh",
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str, expected_type: TokenType) -> dict[str, Any]:
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("type") != expected_type:
        raise JWTError(f"Invalid token type: expected {expected_type}")
    return payload
