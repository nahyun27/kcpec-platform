from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.counseling import CounselingStatus


class SurveySubmit(BaseModel):
    # 항목명(질문) → 응답 텍스트
    responses: dict[str, str] = Field(min_length=1)


class SurveyResponse(BaseModel):
    id: int
    order_id: int
    status: CounselingStatus
    submitted_at: datetime
    final_pdf_url: str | None

    model_config = ConfigDict(from_attributes=True)


class SurveyStatusResponse(BaseModel):
    id: int
    status: CounselingStatus
    submitted_at: datetime
    draft_sent_at: datetime | None
    completed_at: datetime | None
    final_pdf_url: str | None

    model_config = ConfigDict(from_attributes=True)


class SurveyDetailResponse(BaseModel):
    """본인 설문 상세 — 응답 본문 포함."""

    id: int
    order_id: int
    status: CounselingStatus
    responses: dict[str, str]
    submitted_at: datetime
    ai_draft_url: str | None
    final_pdf_url: str | None

    model_config = ConfigDict(from_attributes=True)


class SurveyUpdate(BaseModel):
    responses: dict[str, str] = Field(min_length=1)
