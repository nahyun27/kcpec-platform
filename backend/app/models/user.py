from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    # 실명/연락처 — 어드민이 문의·환불 대응 시 고객을 식별하기 위한 프로필 정보.
    # 서류(수료증 등)에 들어가는 이름은 여전히 발급 시점에 별도 입력받는다
    # (IssuedDocument.recipient_name) — 대리 발급 등 필요해 분리되어 있음.
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)

    social_provider: Mapped[str | None] = mapped_column(String(20), nullable=True)
    social_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    # 비밀번호 재설정 — 토큰은 추측 불가능한 랜덤값, 발급 후 일정 시간 지나면
    # (core/security 의 PASSWORD_RESET_EXPIRE_MINUTES) 무효 처리.
    password_reset_token: Mapped[str | None] = mapped_column(
        String(64), unique=True, nullable=True
    )
    password_reset_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # 이메일 인증 — 수료증/상담의견서가 가입 이메일로 발송되는데 인증 없이는
    # 오타/타인 이메일로도 바로 가입이 돼버려 서류가 조용히 안 갈 수 있었음.
    # 미인증이어도 로그인/이용 자체는 막지 않고(가입 마찰 최소화), 마이페이지에
    # 배너로 인증 안내만 한다. 소셜 로그인은 provider 가 이미 이메일을
    # 검증했다고 보고 가입 즉시 인증완료 처리.
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_verify_token: Mapped[str | None] = mapped_column(
        String(64), unique=True, nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
