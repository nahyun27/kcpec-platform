"""가입 다음 날 미결제 회원 안내 메일(광고) 발송.

매일 오전 9시(KST) cron 으로 실행:
  - 대상: 전날 0시~24시(KST) 가입 + 혜택·안내 메일 수신 동의 + 결제완료 주문 없음
          + 활성 계정 + 아직 이 메일을 받은 적 없음
  - 한 사람에게 한 번만 보낸다(welcome_mail_sent_at 기록).

사용:
    cd backend && venv/bin/python scripts/send_welcome_mail.py            # 실제 발송
    cd backend && venv/bin/python scripts/send_welcome_mail.py --dry-run  # 대상만 출력
"""

from __future__ import annotations

import sys
from datetime import datetime, time, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import exists, select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.core.email import send_welcome_marketing_mail  # noqa: E402
from app.core.marketing import unsubscribe_url  # noqa: E402
from app.models.order import Order, OrderStatus  # noqa: E402
from app.models.user import User  # noqa: E402

KST = timezone(timedelta(hours=9))


def main(dry_run: bool) -> None:
    today = datetime.now(KST).date()
    start = datetime.combine(today - timedelta(days=1), time.min, tzinfo=KST)
    end = datetime.combine(today, time.min, tzinfo=KST)

    db = SessionLocal()
    try:
        users = db.scalars(
            select(User).where(
                User.created_at >= start,
                User.created_at < end,
                User.marketing_consent.is_(True),
                User.welcome_mail_sent_at.is_(None),
                User.is_active.is_(True),
                User.is_admin.is_(False),
                ~User.email.like("%.local"),
                ~exists().where(Order.user_id == User.id, Order.status == OrderStatus.PAID),
            )
        ).all()
        print(f"[{datetime.now(KST):%Y-%m-%d %H:%M}] 대상 {len(users)}명 ({start:%m/%d} 가입)")
        sent = 0
        for u in users:
            if dry_run:
                print(f"  (dry-run) {u.username} <{u.email}>")
                continue
            if send_welcome_marketing_mail(to_email=u.email, unsubscribe_url=unsubscribe_url(u.id)):
                u.welcome_mail_sent_at = datetime.now(timezone.utc)
                db.commit()
                sent += 1
            else:
                print(f"  발송 실패: {u.username}")
        if not dry_run:
            print(f"  발송 완료 {sent}/{len(users)}")
    finally:
        db.close()


if __name__ == "__main__":
    main(dry_run="--dry-run" in sys.argv)
