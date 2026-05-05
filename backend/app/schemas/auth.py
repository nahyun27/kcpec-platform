from datetime import date, datetime

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


class DeleteMeRequest(BaseModel):
    # 일반 로그인 사용자만 비밀번호 재확인 필요. 소셜 로그인은 None 으로 보냄.
    password: str | None = None


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
