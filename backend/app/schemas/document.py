from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.document import IssuedDocumentStatus, IssuedDocumentType


class DocumentIssueRequest(BaseModel):
    recipient_name: str = Field(min_length=1, max_length=100)
    recipient_birth: date


class DocumentResponse(BaseModel):
    id: int
    document_type: IssuedDocumentType
    issue_number: str
    status: IssuedDocumentStatus
    pdf_url: str | None
    issued_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
