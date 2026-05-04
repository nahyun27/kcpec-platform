import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.pdf import render_certificate
from app.models.course import Course
from app.models.document import (
    IssuedDocument,
    IssuedDocumentStatus,
    IssuedDocumentType,
)
from app.models.order import Order, OrderStatus
from app.models.user import User
from app.schemas.document import DocumentIssueRequest, DocumentResponse

router = APIRouter(prefix="/orders", tags=["documents"])


def _generate_issue_number() -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    suffix = secrets.token_hex(3).upper()  # 6 hex chars
    return f"KCPEC-{today}-{suffix}"


@router.post(
    "/{order_id}/issue",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def issue_document(
    order_id: int,
    payload: DocumentIssueRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentResponse:
    order = db.get(Order, order_id)
    if order is None or order.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="주문을 찾을 수 없습니다.")
    if order.status != OrderStatus.PAID:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="결제 완료된 주문에 한해 이수증을 발급할 수 있습니다.",
        )

    course = db.get(Course, order.course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="강의 정보를 찾을 수 없습니다.")

    issue_number = _generate_issue_number()
    completed_date = (order.paid_at or datetime.now(timezone.utc)).date()

    pdf_path = render_certificate(
        issue_number=issue_number,
        recipient_name=payload.recipient_name,
        recipient_birth=payload.recipient_birth,
        course_title=course.title,
        completed_at=completed_date,
    )
    pdf_url = str(request.url_for("static", path=f"pdfs/{pdf_path.name}"))

    doc = IssuedDocument(
        order_id=order.id,
        user_id=current_user.id,
        document_type=IssuedDocumentType.CERTIFICATE,
        recipient_name=payload.recipient_name,
        recipient_birth=payload.recipient_birth,
        pdf_url=pdf_url,
        issue_number=issue_number,
        status=IssuedDocumentStatus.READY,
        issued_at=datetime.now(timezone.utc),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return DocumentResponse.model_validate(doc)


@router.get("/{order_id}/documents", response_model=list[DocumentResponse])
def list_order_documents(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DocumentResponse]:
    order = db.get(Order, order_id)
    if order is None or order.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="주문을 찾을 수 없습니다.")
    docs = list(
        db.scalars(
            select(IssuedDocument)
            .where(IssuedDocument.order_id == order_id)
            .order_by(IssuedDocument.id.desc())
        ).all()
    )
    return [DocumentResponse.model_validate(d) for d in docs]
