from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "KCPEC Platform API"
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = Field(
        default="postgresql+psycopg2://kcpec:kcpec@localhost:5432/kcpec",
    )

    JWT_SECRET_KEY: str = Field(default="change-me-in-production")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    TOSS_SECRET_KEY: str | None = None
    TOSS_API_BASE: str = "https://api.tosspayments.com"

    BANK_TRANSFER_ACCOUNT: str = (
        "국민은행 123-456-789012 (예금주: 한국범죄예방교육센터)"
    )

    # 의견서 초안 생성 LLM. Gemini 우선; 미설정 시 dummy fallback.
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    # (legacy) Anthropic 설정 — 현재 미사용. 추후 정리 예정.
    ANTHROPIC_API_KEY: str | None = None
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"

    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str | None = None  # 미설정 시 SMTP_USER 사용
    STAFF_EMAIL: str | None = None

    AWS_REGION: str | None = None
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_S3_VIDEO_BUCKET: str | None = None
    CLOUDFRONT_DOMAIN: str | None = None
    STREAM_URL_EXPIRE_SECONDS: int = 3600

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
