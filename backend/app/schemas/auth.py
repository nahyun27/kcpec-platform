from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupRequest(BaseModel):
    username: str = Field(min_length=4, max_length=50, pattern=r"^[A-Za-z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)
    email: EmailStr
    birth_date: date


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


SocialProvider = Literal["kakao", "naver", "google"]


class SocialLoginRequest(BaseModel):
    """B-flow 내부 helper. 백엔드 callback 에서 토큰/유저 교환을 끝낸 후
    동일 로직을 외부에서도 호출할 수 있도록 노출 — 신규면 자동 가입, 기존
    이면 로그인 후 JWT 반환.
    """

    provider: SocialProvider
    provider_id: str = Field(min_length=1, max_length=255)
    email: EmailStr
    name: str = Field(min_length=1, max_length=100)


class DeleteMeRequest(BaseModel):
    # 일반 로그인 사용자만 비밀번호 재확인 필요. 소셜 로그인은 None 으로 보냄.
    password: str | None = None


class ProfileUpdateRequest(BaseModel):
    email: EmailStr | None = None
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    birth_date: date | None
    social_provider: str | None
    is_active: bool
    is_admin: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
