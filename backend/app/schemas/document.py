from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.validators import validate_birth_date
from app.models.document import IssuedDocumentStatus, IssuedDocumentType


class DocumentIssueRequest(BaseModel):
    recipient_name: str = Field(min_length=1, max_length=100)
    recipient_birth: date

    _validate_recipient_birth = field_validator("recipient_birth")(validate_birth_date)


class DocumentResponse(BaseModel):
    id: int
    document_type: IssuedDocumentType
    issue_number: str
    status: IssuedDocumentStatus
    pdf_url: str | None
    pledge_pdf_url: str | None = None
    recipient_name: str
    recipient_birth: date
    issued_at: datetime | None
    downloaded_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminCertificateCorrection(BaseModel):
    """발급 후 수령인 정보 오타 정정용(2026-10) — 수강생 본인은 고칠 수 없고
    관리자만 가능. 여기서 고친 값은 다음 /export 부터 반영되며, 이미 공개된
    pdf_url/pledge_pdf_url 자체는 별도로 /upload-final 업로드해야 바뀐다."""

    recipient_name: str = Field(min_length=1, max_length=100)
    recipient_birth: date

    _validate_recipient_birth = field_validator("recipient_birth")(validate_birth_date)


class AdminCertificateExportRequest(BaseModel):
    target: Literal["certificate", "pledge"] = "certificate"
