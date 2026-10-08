from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LawyerPartnerPublic(BaseModel):
    """결제 화면 선택지용 — 활성 파트너만, 최소 정보만."""

    id: int
    law_firm_name: str
    lawyer_name: str

    model_config = ConfigDict(from_attributes=True)


class AdminLawyerPartnerRow(BaseModel):
    id: int
    law_firm_name: str
    lawyer_name: str
    is_active: bool
    created_at: datetime
    # 이 파트너를 선택해 들어온 누적 주문 수(결제완료 기준) — 리퍼럴 통계용.
    referral_order_count: int

    model_config = ConfigDict(from_attributes=True)


class LawyerPartnerCreate(BaseModel):
    law_firm_name: str = Field(min_length=1, max_length=200)
    lawyer_name: str = Field(min_length=1, max_length=100)


class LawyerPartnerPatch(BaseModel):
    law_firm_name: str | None = Field(default=None, min_length=1, max_length=200)
    lawyer_name: str | None = Field(default=None, min_length=1, max_length=100)
    is_active: bool | None = None
