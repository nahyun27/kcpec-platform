import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DetentionStatus(str, enum.Enum):
    RECEIVED = "received"  # 접수(결제 후 자료 발송 대기)
    MATERIALS_SENT = "materials_sent"  # 교육자료 우편 발송 완료(회신 대기)
    COMPLETED = "completed"  # 수료증 발급·이메일 발송 완료
    CANCELLED = "cancelled"


class DetentionApplication(Base):
    """구속수용자 교육 신청 — 보호자가 수용자 정보를 입력하고 결제하면 생성.

    교육자료를 우편으로 발송하고 회신(약 1주) 후 수료증을 이메일로 발급하는
    오프라인 진행 건이라, 주문(bundle)과 별개로 접수 정보·진행 상태를 관리한다.
    수용번호·주소는 민감한 개인정보라 목록 API 외에는 노출하지 않는다.
    """

    __tablename__ = "detention_applications"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # 이 신청으로 만들어진 주문들(강의별 + 자료·발송비)의 묶음 결제 id.
    bundle_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)

    inmate_name: Mapped[str] = mapped_column(String(100), nullable=False)
    inmate_birth: Mapped[date] = mapped_column(Date, nullable=False)
    inmate_number: Mapped[str] = mapped_column(String(50), nullable=False)
    facility_name: Mapped[str] = mapped_column(String(100), nullable=False)
    postal_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address: Mapped[str] = mapped_column(String(300), nullable=False)
    # 최종 양형자료(수료증 등) 수령 경로 메모 — 자택/변호사사무실/법원 등.
    delivery_note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    contact_phone: Mapped[str] = mapped_column(String(30), nullable=False)
    # 수료증은 마이페이지에서 확인하므로 별도 입력을 받지 않고, 신청자 계정
    # 이메일을 그대로 저장한다(발급 완료 안내 메일 수신용).
    certificate_email: Mapped[str] = mapped_column(String(255), nullable=False)
    # 신청자(보호자)와 수용자의 관계 — 배우자/부모/자녀/형제·자매/기타 가족.
    applicant_relation: Mapped[str | None] = mapped_column(String(30), nullable=True)

    status: Mapped[DetentionStatus] = mapped_column(
        Enum(
            DetentionStatus,
            name="detention_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=DetentionStatus.RECEIVED,
        index=True,
    )
    tracking_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    admin_memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    materials_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # 보호자가 "수용자가 학습을 마쳤다"고 확인한 시각 — 발송 후 7일이 지나야
    # 확인할 수 있고, 이 값이 있어야 관리자가 수료증을 발급할 수 있다.
    learning_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
