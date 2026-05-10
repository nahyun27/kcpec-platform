from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models.counseling import CounselingStatus
from app.models.order import OrderStatus, PaymentMethod


CounselingType = Literal["basic", "phone", "inperson"]


class CounselingPurchaseRequest(BaseModel):
    counseling_type: CounselingType


class CounselingPurchaseResponse(BaseModel):
    order_id: int
    course_id: int
    amount: int
    status: OrderStatus
    payment_method: PaymentMethod
    requires_payment: bool
    counseling_type: CounselingType


class CounselingOrderItem(BaseModel):
    order_id: int
    counseling_type: CounselingType
    program_title: str
    amount: int
    status: OrderStatus
    payment_method: PaymentMethod
    created_at: datetime
    paid_at: datetime | None
    # 본인 설문 상세 조회 / 수정 시 사용 (제출 전이면 None).
    survey_id: int | None
    survey_status: CounselingStatus | None
    final_pdf_url: str | None

    model_config = ConfigDict(from_attributes=True)
