from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.pdf import generate_certificate_pdf
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
            detail="결제 완료된 주문에 한해 수료증을 발급할 수 있습니다.",
        )

    course = db.get(Course, order.course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="강의 정보를 찾을 수 없습니다.")

    issued_date = (order.paid_at or datetime.now(timezone.utc)).date()

    # IssuedDocument 를 먼저 flush 해 doc.id 를 확보 — 증서번호와 PDF 파일명에 사용.
    doc = IssuedDocument(
        order_id=order.id,
        user_id=current_user.id,
        document_type=IssuedDocumentType.CERTIFICATE,
        recipient_name=payload.recipient_name,
        recipient_birth=payload.recipient_birth,
        pdf_url="",  # PDF 생성 후 채움
        issue_number="",  # 동일
        status=IssuedDocumentStatus.READY,
        issued_at=datetime.now(timezone.utc),
    )
    db.add(doc)
    db.flush()

    pdf_path, issue_number = generate_certificate_pdf(
        course_id=course.id,
        doc_id=doc.id,
        recipient_name=payload.recipient_name,
        birth_date=payload.recipient_birth,
        issued_date=issued_date,
    )

    doc.pdf_url = str(request.url_for("static", path=f"pdfs/{pdf_path.name}"))
    doc.issue_number = issue_number

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
