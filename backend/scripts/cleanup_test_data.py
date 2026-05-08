"""테스트 흐름에서 누적된 PENDING 주문을 일괄 삭제.

- status='paid' 주문은 보존 (실 결제 데이터)
- status='pending' / 'cancelled' / 'refunded' 등은 삭제 대상
- IssuedDocument 는 Order CASCADE 로 함께 정리됨
- LectureProgress / Enrollment 는 손대지 않음

실행: `cd backend && venv/bin/python scripts/cleanup_test_data.py`
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, func, select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.models.document import IssuedDocument  # noqa: E402
from app.models.order import Order, OrderStatus  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        # 삭제 대상: paid 가 아닌 모든 주문
        target_q = select(Order.id, Order.status).where(Order.status != OrderStatus.PAID)
        rows = db.execute(target_q).all()
        if not rows:
            print("정리할 주문이 없습니다. (paid 가 아닌 주문 0건)")
            return

        by_status: dict[str, int] = {}
        for _, status in rows:
            key = status.value if hasattr(status, "value") else str(status)
            by_status[key] = by_status.get(key, 0) + 1

        target_ids = [r[0] for r in rows]

        doc_count = db.scalar(
            select(func.count(IssuedDocument.id)).where(IssuedDocument.order_id.in_(target_ids))
        ) or 0

        print("삭제 예정:")
        for k, v in sorted(by_status.items()):
            print(f"  - status={k}: {v}건")
        print(f"  → CASCADE 로 함께 삭제될 IssuedDocument: {doc_count}건")
        print()

        # 멱등성 위해 by-id delete (in_ 필터로 안전)
        result = db.execute(delete(Order).where(Order.id.in_(target_ids)))
        db.commit()
        print(f"✓ 삭제 완료: {result.rowcount}건 (paid 주문은 그대로 보존됨)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
