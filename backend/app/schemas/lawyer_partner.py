from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.lawyer_partner import LawyerPartnerStatus


class LawyerPartnerPublic(BaseModel):
    """추천 코드 확인 응답용 — 코드를 정확히 아는 사람에게만, 최소 정보만.
    전체 목록을 보여주는 용도로는 절대 쓰지 않는다(2026-10, 목록 노출로
    아무나 할인받을 수 있던 허점 수정)."""

    id: int
    law_firm_name: str
    lawyer_name: str

    model_config = ConfigDict(from_attributes=True)


class AdminLawyerPartnerRow(BaseModel):
    id: int
    law_firm_name: str
    lawyer_name: str
    email: str | None = None
    phone: str | None = None
    referral_code: str
    # 변호사 전용 "마이페이지" 링크에 쓰는 토큰 — 관리자가 이 값으로 링크를
    # 만들어 변호사에게 직접 전달한다(QR 포함).
    portal_token: str
    status: LawyerPartnerStatus
    created_at: datetime
    # 이 파트너를 선택해 들어온 누적 주문 수(결제완료 기준) — 리퍼럴 통계용.
    referral_order_count: int

    model_config = ConfigDict(from_attributes=True)


class LawyerPartnerPortalInfo(BaseModel):
    """변호사 전용 "마이페이지" 응답 — portal_token 으로만 조회, 로그인 없음."""

    law_firm_name: str
    lawyer_name: str
    referral_code: str
    status: LawyerPartnerStatus
    referral_order_count: int

    model_config = ConfigDict(from_attributes=True)


class LawyerPartnerCreate(BaseModel):
    """관리자가 /admin/lawyer-partners 에서 직접 등록 — 승인 절차 없이
    바로 ACTIVE로 생성된다(자가 신청은 LawyerPartnerApplyRequest 참고)."""

    law_firm_name: str = Field(min_length=1, max_length=200)
    lawyer_name: str = Field(min_length=1, max_length=100)
    # EmailStr 대신 평범한 str — 탈퇴 계정 익명화 이메일(.local 등)에서
    # EmailStr 가 정상 주소를 거부한 전례가 있어 이 플랫폼에서는 이메일
    # 필드에 EmailStr 를 쓰지 않는 게 관례.
    email: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=50)


class LawyerPartnerPatch(BaseModel):
    law_firm_name: str | None = Field(default=None, min_length=1, max_length=200)
    lawyer_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    status: LawyerPartnerStatus | None = None


class LawyerPartnerApplyRequest(BaseModel):
    """/partner 페이지에서 변호사 사무실이 직접 제출하는 제휴 신청 — 공개
    엔드포인트. 생성 즉시 PENDING 상태라 관리자가 승인하기 전까지는 추천
    코드가 결제 화면에서 동작하지 않는다."""

    law_firm_name: str = Field(min_length=1, max_length=200)
    lawyer_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=1, max_length=50)
