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
