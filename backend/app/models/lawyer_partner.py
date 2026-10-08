import enum
import secrets
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# 사람이 직접 입력하는 코드라 헷갈리는 문자(0/O, 1/I)는 뺀 8자리.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_referral_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))


def generate_portal_token() -> str:
    return secrets.token_urlsafe(32)


class LawyerPartnerStatus(str, enum.Enum):
    # 변호사 사무실이 /partner/apply 에서 직접 신청 — 관리자 승인 전.
    # 코드는 미리 발급돼 있지만 ACTIVE 가 아니면 결제 화면에서 거부된다.
    PENDING = "pending"
    # 승인되어 결제 화면에서 실제로 쓸 수 있는 상태.
    ACTIVE = "active"
    # 승인됐다가 관리자가 그만 쓰기로 하고 꺼둔 상태.
    INACTIVE = "inactive"
    # 신청을 반려함.
    REJECTED = "rejected"


class LawyerPartner(Base):
    """변호사 사무실 리퍼럴 파트너 — 결제 시 의뢰인이 안내받은 추천 코드를
    입력하면 10% 할인이 적용된다(2026-10). 처음엔 "목록에서 사무실 선택"
    방식이었으나, 아무나 전체 목록을 보고 할인을 받을 수 있는 허점이 있어
    사무실마다 고유 코드를 발급하고 그 코드를 아는 사람만 할인받을 수 있게
    변경했다(2026-10, 실사용 중 발견). 이후 변호사 사무실이 /partner/apply
    에서 직접 신청하고 관리자가 승인하는 흐름으로 확장(2026-10). 사무실/
    변호사와의 정산은 없고, 관리자가 승인한 사무실만 관리하며 주문에 어느
    변호사였는지만 기록한다.
    """

    __tablename__ = "lawyer_partners"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    law_firm_name: Mapped[str] = mapped_column(String(200), nullable=False)
    lawyer_name: Mapped[str] = mapped_column(String(100), nullable=False)
    # 포털 링크(QR·안내문구) 발송용. 자가 신청은 필수로 받지만, 기존에
    # 관리자가 직접 등록한 행은 비어있을 수 있어 컬럼 자체는 nullable.
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # 의뢰인이 결제 화면에서 직접 입력하는 추천 코드 — 추측 불가능한 랜덤
    # 값(관리자가 사무실에 전달). 전체 목록은 어디에도 공개 노출하지 않는다.
    referral_code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    # 변호사 전용 "마이페이지"(본인 코드·누적 소개 건수 확인) 링크에 쓰는
    # 별도 토큰 — referral_code 는 의뢰인도 다 알게 되는 값이라 그걸 그대로
    # 링크에 쓰면 의뢰인도 이 페이지를 볼 수 있다. 완전히 다른 랜덤 값을
    # 써서 이 링크는 승인 시에만 이메일로 전달한다(2026-10).
    portal_token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    status: Mapped[LawyerPartnerStatus] = mapped_column(
        Enum(
            LawyerPartnerStatus,
            name="lawyer_partner_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=LawyerPartnerStatus.ACTIVE,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
