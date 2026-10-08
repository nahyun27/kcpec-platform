import secrets
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func, true
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# 사람이 직접 입력하는 코드라 헷갈리는 문자(0/O, 1/I)는 뺀 8자리.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_referral_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))


class LawyerPartner(Base):
    """변호사 사무실 리퍼럴 파트너 — 결제 시 의뢰인이 안내받은 추천 코드를
    입력하면 10% 할인이 적용된다(2026-10). 처음엔 "목록에서 사무실 선택"
    방식이었으나, 아무나 전체 목록을 보고 할인을 받을 수 있는 허점이 있어
    사무실마다 고유 코드를 발급하고 그 코드를 아는 사람만 할인받을 수 있게
    변경(2026-10, 실사용 중 발견). 사무실/변호사와의 정산은 없고, 관리자가
    이 목록을 직접 추가/삭제하며 주문에 어느 변호사였는지만 기록한다.
    """

    __tablename__ = "lawyer_partners"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    law_firm_name: Mapped[str] = mapped_column(String(200), nullable=False)
    lawyer_name: Mapped[str] = mapped_column(String(100), nullable=False)
    # 의뢰인이 결제 화면에서 직접 입력하는 추천 코드 — 추측 불가능한 랜덤
    # 값(관리자가 사무실에 전달). 전체 목록은 어디에도 공개 노출하지 않는다.
    referral_code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    # 비활성화하면 결제 화면 선택지에서는 빠지지만, 과거 주문의 기록(FK)은
    # 그대로 남는다 — 삭제 대신 비활성화를 기본으로 쓰도록 안내.
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=true())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
