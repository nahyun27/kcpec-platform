"""더미 매출 주문 30건 시드.

- 10명의 더미 유저 (없으면 생성, 있으면 재사용)
- 강의 + 패키지는 DB 에 이미 존재하는 (course, package) 조합에서 랜덤 추출
- 결제수단은 card / bank_transfer / kakaopay / naverpay 랜덤
- status=PAID 로 통일, paid_at 은 최근 30일 균일 분포
- order_type=COURSE (심리상담 독립 주문은 제외)

멱등하지 않음 — 매 실행마다 새 30건이 추가됨. 정리하려면 cleanup 스크립트
이후 paid 행도 비우려면 직접 SQL 사용.

실행: `cd backend && venv/bin/python scripts/seed_dummy_orders.py`
"""

from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.course import Course, CourseCategory  # noqa: E402
from app.models.order import Order, OrderStatus, OrderType, PaymentMethod  # noqa: E402
from app.models.package import Package, PackageTier  # noqa: E402
from app.models.user import User  # noqa: E402

# 백엔드 packages.price 는 null 정책이라 프론트 checkout 의 PACKAGE_PRICE 와
# 동일한 매핑을 여기 둠. 변경 시 양쪽 함께 갱신.
PACKAGE_PRICE_BY_TIER: dict[PackageTier, int] = {
    PackageTier.BASIC: 110_000,
    PackageTier.STANDARD: 220_000,
    PackageTier.PREMIUM: 550_000,
}

DUMMY_USERS: list[tuple[str, str]] = [
    ("김민준", "dummy_minjun@kcpec.example"),
    ("이서연", "dummy_seoyeon@kcpec.example"),
    ("박지호", "dummy_jiho@kcpec.example"),
    ("최수아", "dummy_sua@kcpec.example"),
    ("정도현", "dummy_dohyun@kcpec.example"),
    ("강하은", "dummy_haeun@kcpec.example"),
    ("윤지우", "dummy_jiwoo@kcpec.example"),
    ("장은우", "dummy_eunwoo@kcpec.example"),
    ("임채린", "dummy_chaerin@kcpec.example"),
    ("송예준", "dummy_yejun@kcpec.example"),
]

ORDER_COUNT = 30
DAYS_BACK = 30
PAYMENT_METHODS = [
    PaymentMethod.CARD,
    PaymentMethod.CARD,        # 카드 가중치 ↑
    PaymentMethod.KAKAOPAY,
    PaymentMethod.NAVERPAY,
    PaymentMethod.BANK_TRANSFER,
]


def ensure_dummy_users(db) -> list[User]:
    out: list[User] = []
    pwd = hash_password("dummy-password-1!")
    for username, email in DUMMY_USERS:
        existing = db.scalar(select(User).where(User.email == email))
        if existing is not None:
            out.append(existing)
            continue
        user = User(
            username=username,
            email=email,
            password_hash=pwd,
            is_active=True,
            is_admin=False,
        )
        db.add(user)
        db.flush()
        out.append(user)
    return out


def get_course_package_pairs(db) -> list[tuple[Course, Package]]:
    """강의 × 패키지 cross product. 패키지는 글로벌(코스에 묶이지 않음)."""
    courses = list(
        db.scalars(
            select(Course)
            .where(Course.category != CourseCategory.COUNSELING, Course.is_active.is_(True))
        ).all()
    )
    packages = list(db.scalars(select(Package)).all())
    if not courses or not packages:
        return []
    return [(c, p) for c in courses for p in packages]


def package_price(p: Package) -> int:
    """packages.price 가 null 인 정책이므로 tier 매핑으로 결정."""
    if p.price is not None and p.price > 0:
        return p.price
    return PACKAGE_PRICE_BY_TIER.get(p.tier, 0)


def main() -> None:
    db = SessionLocal()
    try:
        users = ensure_dummy_users(db)
        if not users:
            print("더미 유저 생성 실패")
            return
        pairs = get_course_package_pairs(db)
        if not pairs:
            print("강의/패키지 조합이 없습니다 — seed.py 먼저 실행하세요.")
            return

        now = datetime.now(timezone.utc)
        rng = random.Random(20260508)  # 결정론적 분포 (재현 가능)

        created = 0
        for _ in range(ORDER_COUNT):
            user = rng.choice(users)
            course, package = rng.choice(pairs)
            method = rng.choice(PAYMENT_METHODS)
            offset_seconds = rng.randint(0, DAYS_BACK * 24 * 3600)
            paid_at = now - timedelta(seconds=offset_seconds)

            amount = package_price(package)
            if amount <= 0:
                continue
            order = Order(
                user_id=user.id,
                course_id=course.id,
                package_id=package.id,
                order_type=OrderType.COURSE,
                payment_method=method,
                amount=amount,
                status=OrderStatus.PAID,
                created_at=paid_at - timedelta(minutes=rng.randint(1, 30)),
                paid_at=paid_at,
            )
            db.add(order)
            created += 1

        db.commit()
        print(f"✓ 더미 주문 {created}건 생성 완료")
        print(
            f"  - 유저 풀: {len(users)}명 / 강의·패키지 조합 풀: {len(pairs)}쌍 / 최근 {DAYS_BACK}일",
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
