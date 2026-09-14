from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.validators import validate_birth_date


class SignupRequest(BaseModel):
    username: str = Field(min_length=4, max_length=50, pattern=r"^[A-Za-z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)
    email: EmailStr
    birth_date: date

    _validate_birth_date = field_validator("birth_date")(validate_birth_date)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


SocialProvider = Literal["kakao", "naver", "google"]


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=1)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


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
    name: str | None
    phone: str | None
    birth_date: date | None
    social_provider: str | None
    is_active: bool
    is_admin: bool
    is_verified: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
