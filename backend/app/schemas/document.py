from datetime import date, datetime

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
    issued_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
