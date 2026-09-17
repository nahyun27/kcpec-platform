"""과정코드별 증서번호 순번 채번.

구 사이트 발급 이력을 이어받기 위해 doc.id(전역 순번) 대신 과정코드별로
따로 세는 순번을 쓴다(2026-09, alembic 0037 참고). 동시 발급 시 경합
방지를 위해 SELECT ... FOR UPDATE 로 행을 잠그고 증가시킨다.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import CertificateSequence


def reserve_next_sequence(db: Session, course_code: str) -> int:
    row = db.scalar(
        select(CertificateSequence)
        .where(CertificateSequence.course_code == course_code)
        .with_for_update()
    )
    if row is None:
        # 시딩 안 된(예상 밖) 코드 — 안전하게 1부터 시작.
        row = CertificateSequence(course_code=course_code, next_number=1)
        db.add(row)
        db.flush()
    n = row.next_number
    row.next_number = n + 1
    return n
