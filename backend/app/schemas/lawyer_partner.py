from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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
    referral_code: str
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
