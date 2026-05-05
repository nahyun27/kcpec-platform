"""관리자 계정 생성/승격 스크립트.

- username='admin' 계정이 없으면 만들고, 있으면 is_admin=True 로 승격한다.
- 비밀번호는 환경변수 ADMIN_PASSWORD 우선, 없으면 'admin1234' 기본.
- 이메일은 환경변수 ADMIN_EMAIL 우선, 없으면 'admin@kcpec.local'.
- 멱등(idempotent) — 여러 번 실행해도 안전.

사용:
    cd backend && venv/bin/python scripts/create_admin.py
    # 또는
    ADMIN_PASSWORD=mySecret venv/bin/python scripts/create_admin.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.user import User  # noqa: E402


USERNAME = "admin"
DEFAULT_PASSWORD = "admin1234"
# pydantic EmailStr 가 거부하는 .local / .test / .example 류 reserved TLD 는 사용 금지.
DEFAULT_EMAIL = "admin@kcpec.co.kr"


def main() -> None:
    password = os.getenv("ADMIN_PASSWORD", DEFAULT_PASSWORD)
    email = os.getenv("ADMIN_EMAIL", DEFAULT_EMAIL)

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == USERNAME))
        if user is None:
            user = User(
                username=USERNAME,
                password_hash=hash_password(password),
                email=email,
                is_active=True,
                is_admin=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"✅ admin 계정 생성: id={user.id}, email={user.email}")
            print(f"   로그인: {USERNAME} / {password}")
            return

        # 이미 존재 — 권한/활성화 보장 + 만료된 reserved TLD 이메일이면 갱신
        changed = False
        if not user.is_admin:
            user.is_admin = True
            changed = True
        if not user.is_active:
            user.is_active = True
            changed = True
        if user.email and user.email.endswith((".local", ".test", ".example", ".invalid")):
            print(f"   ⚠ 기존 이메일 '{user.email}' 은 reserved TLD 라 수정합니다.")
            user.email = email
            changed = True
        # ADMIN_PASSWORD 가 명시적으로 지정된 경우에만 비밀번호 갱신
        if "ADMIN_PASSWORD" in os.environ:
            user.password_hash = hash_password(password)
            changed = True
            print("   비밀번호를 ADMIN_PASSWORD 환경변수 값으로 갱신했습니다.")

        if changed:
            db.commit()
            print(f"♻️  기존 '{USERNAME}' 계정을 관리자로 갱신했습니다 (id={user.id}).")
        else:
            print(f"✅ '{USERNAME}' 계정은 이미 관리자입니다 (id={user.id}).")


if __name__ == "__main__":
    main()
