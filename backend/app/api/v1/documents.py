import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.email import send_certificate_to_user
from app.core.pdf import generate_certificate_pdf
from app.models.course import Course
from app.models.document import (
    IssuedDocument,
    IssuedDocumentStatus,
    IssuedDocumentType,
)
from app.models.enrollment import Enrollment
from app.models.order import Order, OrderStatus, OrderType
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
    background_tasks: BackgroundTasks,
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

    # 이미 발급된(취소되지 않은) 서류가 있으면 그대로 반환 — 없으면 한 번의
    # 완주(결제)로 recipient_name/recipient_birth 만 바꿔가며 서로 다른
    # 사람 명의의 "정식" 법원 제출용 서류를 무한정 찍어낼 수 있었다.
    existing = db.scalar(
        select(IssuedDocument).where(
            IssuedDocument.order_id == order.id,
            IssuedDocument.status != IssuedDocumentStatus.REVOKED,
        )
    )
    if existing is not None:
        return DocumentResponse.model_validate(existing)

    # 일반 강의 주문(COURSE)은 결제만으로 발급 불가 — 진도+퀴즈를 완주(enrollment.is_completed)
    # 해야만 수료증 발급 가능. (심리상담 독립 구매(COUNSELING)는 강의 개념이 없어 제외.)
    if order.order_type == OrderType.COURSE:
        enrollment = db.scalar(
            select(Enrollment).where(
                Enrollment.user_id == current_user.id,
                Enrollment.course_id == order.course_id,
            )
        )
        if enrollment is None or not enrollment.is_completed:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="강의 수료(진도+퀴즈 통과) 후에 수료증을 발급할 수 있습니다.",
            )

    issued_date = (order.paid_at or datetime.now(timezone.utc)).date()

    # IssuedDocument 를 먼저 flush 해 doc.id 확보 — 증서번호에 사용.
    # pdf 파일명은 doc.id 가 아니라 별도 랜덤 access_token 사용 (아래 참고).
    doc = IssuedDocument(
        order_id=order.id,
        user_id=current_user.id,
        document_type=IssuedDocumentType.CERTIFICATE,
        recipient_name=payload.recipient_name,
        recipient_birth=payload.recipient_birth,
        pdf_url="",
        issue_number="",
        access_token=secrets.token_urlsafe(24),
        status=IssuedDocumentStatus.READY,
        issued_at=datetime.now(timezone.utc),
    )
    db.add(doc)
    db.flush()

    pdf_path, issue_number = generate_certificate_pdf(
        course_title=course.title,
        doc_id=doc.id,
        file_token=doc.access_token,
        recipient_name=payload.recipient_name,
        birth_date=payload.recipient_birth,
        issued_date=issued_date,
    )

    doc.pdf_url = str(request.url_for("static", path=f"pdfs/{pdf_path.name}"))
    doc.issue_number = issue_number

    db.commit()
    db.refresh(doc)

    # FAQ("익일 24시까지 이메일로 보내드립니다")에 실제로 발송 코드가 없던
    # 문제를 고침(2026-09) — 심리상담 의견서(admin.py upload_final)는 이미
    # 발송되고 있었는데 수료증만 빠져 있었음.
    background_tasks.add_task(
        send_certificate_to_user,
        to_email=current_user.email,
        recipient_name=payload.recipient_name,
        course_title=course.title,
        pdf_url=doc.pdf_url,
    )

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
