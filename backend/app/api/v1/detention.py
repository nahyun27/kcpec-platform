"""구속수용자 교육 신청 — 보호자가 수용자 정보를 입력하고 결제하면 교육자료를
우편으로 발송하고, 회신 후 관리자가 수료증을 발급해 이메일로 보내는 오프라인
진행 건. 결제는 기존 묶음결제(bundle)를 그대로 재사용한다."""

import logging
import secrets
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.orders import (
    BULK_DISCOUNT_AMOUNT,
    BULK_DISCOUNT_THRESHOLD,
    DETENTION_FEE_COURSE_TITLE,
    DETENTION_FEE_DEFAULT,
    _cancel_stale_pending,
    _enrollment_expired,
)
from app.core.admin import require_admin
from app.core.cert_config import get_cert_template
from app.core.cert_sequence import reserve_next_sequence
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.email import send_detention_certificates, send_detention_confirmed_notification
from app.core.pdf import cert_course_code, generate_certificate_pdf, generate_pledge_pdf
from app.models.course import Course, CourseCategory
from app.models.detention import DetentionApplication, DetentionStatus
from app.models.document import (
    IssuedDocument,
    IssuedDocumentStatus,
    IssuedDocumentType,
)
from app.models.order import Order, OrderStatus, OrderType, PaymentMethod
from app.models.user import User
from app.schemas.order import BundleCreateResponse, BundleItem

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/detention", tags=["detention"])
admin_router = APIRouter(
    prefix="/admin/detention",
    tags=["admin-detention"],
    dependencies=[Depends(require_admin)],
)

KST = timezone(timedelta(hours=9))


def get_or_create_fee_course(db: Session) -> Course:
    course = db.scalar(
        select(Course).where(Course.title == DETENTION_FEE_COURSE_TITLE).limit(1)
    )
    if course is None:
        course = Course(
            title=DETENTION_FEE_COURSE_TITLE,
            description="구속수용자 교육 신청 시 함께 결제되는 교육자료 및 발송비",
            category=CourseCategory.LAW_COMPLIANCE,
            price=DETENTION_FEE_DEFAULT,
            is_active=False,
        )
        db.add(course)
        db.flush()
    return course


# ---------- public --------------------------------------------------------


# 교육자료 발송 후 이 기간이 지나야 보호자가 학습 완료를 확인할 수 있다.
DETENTION_WAIT_DAYS = 7


def _eligible_at(a: DetentionApplication) -> datetime | None:
    if a.materials_sent_at is None:
        return None
    return a.materials_sent_at + timedelta(days=DETENTION_WAIT_DAYS)


class DetentionCourse(BaseModel):
    id: int
    title: str
    price: int
    category: CourseCategory


class DetentionInfo(BaseModel):
    fee_amount: int
    wait_days: int = DETENTION_WAIT_DAYS
    courses: list[DetentionCourse]
    # 신청자(가족) 본인이 함께 받을 수 있는 심리상담 프로그램.
    counseling: list[DetentionCourse] = []
    bulk_discount_threshold: int
    bulk_discount_amount: int


@router.get("/info", response_model=DetentionInfo)
def detention_info(db: Session = Depends(get_db)) -> DetentionInfo:
    fee = db.scalar(
        select(Course.price).where(Course.title == DETENTION_FEE_COURSE_TITLE).limit(1)
    )
    # 신청 가능 과정 = 활성 + 수료증 템플릿이 있는 교육과정(상담/발송비 제외).
    rows = db.scalars(
        select(Course)
        .where(Course.is_active.is_(True), Course.category != CourseCategory.COUNSELING)
        .order_by(Course.id)
    ).all()
    courses = [
        DetentionCourse(id=c.id, title=c.title, price=c.price, category=c.category)
        for c in rows
        if c.title != DETENTION_FEE_COURSE_TITLE and get_cert_template(c.title) is not None
    ]
    counseling = [
        DetentionCourse(id=c.id, title=c.title, price=c.price, category=c.category)
        for c in db.scalars(
            select(Course)
            .where(
                Course.is_active.is_(True),
                Course.category == CourseCategory.COUNSELING,
                Course.price > 0,
            )
            .order_by(Course.id)
        ).all()
    ]
    return DetentionInfo(
        fee_amount=fee if fee is not None else DETENTION_FEE_DEFAULT,
        courses=courses,
        counseling=counseling,
        bulk_discount_threshold=BULK_DISCOUNT_THRESHOLD,
        bulk_discount_amount=BULK_DISCOUNT_AMOUNT,
    )


class DetentionApplyRequest(BaseModel):
    course_ids: list[int] = Field(min_length=1, max_length=10)
    # 신청자(가족) 본인이 함께 수강/상담받을 과정·심리상담 프로그램 — 선택.
    own_course_ids: list[int] = Field(default_factory=list, max_length=15)
    payment_method: PaymentMethod
    inmate_name: str = Field(min_length=1, max_length=100)
    inmate_birth: date
    inmate_number: str = Field(min_length=1, max_length=50)
    facility_name: str = Field(min_length=1, max_length=100)
    postal_code: str | None = Field(default=None, max_length=10)
    address: str = Field(min_length=1, max_length=300)
    delivery_note: str | None = Field(default=None, max_length=300)
    contact_phone: str = Field(min_length=1, max_length=30)
    applicant_relation: str = Field(min_length=1, max_length=30)
    agree_privacy: bool


@router.post("/apply", response_model=BundleCreateResponse, status_code=status.HTTP_201_CREATED)
def apply_detention(
    payload: DetentionApplyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BundleCreateResponse:
    """신청 정보를 저장하고 묶음결제 주문(강의별 + 교육자료·발송비)을 만든다.
    응답은 기존 /orders/bundle 과 같은 형식이라 프론트가 같은 토스 결제 흐름을
    그대로 이어간다. 금액은 서버에서 다시 계산한다(클라이언트 값 불신)."""
    if not payload.agree_privacy:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="개인정보 수집·이용에 동의해 주세요."
        )
    if not (date(1900, 1, 1) <= payload.inmate_birth <= date.today()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="생년월일을 확인해 주세요.")

    _cancel_stale_pending(db, current_user.id)

    course_ids = list(dict.fromkeys(payload.course_ids))
    courses = {
        c.id: c for c in db.scalars(select(Course).where(Course.id.in_(course_ids))).all()
    }
    for cid in course_ids:
        c = courses.get(cid)
        if c is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"강의를 찾을 수 없습니다: {cid}")
        if (
            not c.is_active
            or c.category == CourseCategory.COUNSELING
            or c.title == DETENTION_FEE_COURSE_TITLE
            or get_cert_template(c.title) is None
        ):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"'{c.title}' 은(는) 구속수용자 교육으로 신청할 수 없는 과정입니다.",
            )

    # 신청자 본인 수강/상담 — 수용자용 과정과 겹쳐도 된다(별도 주문).
    own_ids = list(dict.fromkeys(payload.own_course_ids))
    own_courses = {
        c.id: c for c in db.scalars(select(Course).where(Course.id.in_(own_ids))).all()
    } if own_ids else {}
    for cid in own_ids:
        c = own_courses.get(cid)
        if c is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"과정을 찾을 수 없습니다: {cid}")
        if not c.is_active or c.title == DETENTION_FEE_COURSE_TITLE:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"'{c.title}' 은(는) 함께 신청할 수 없는 과정입니다.",
            )
        if c.category != CourseCategory.COUNSELING:
            paid_own = db.scalar(
                select(Order).where(
                    Order.user_id == current_user.id,
                    Order.course_id == cid,
                    Order.status == OrderStatus.PAID,
                    Order.detention_inmate.is_(False),
                )
            )
            if paid_own is not None and not _enrollment_expired(db, current_user.id, cid):
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    detail=f"'{c.title}' 은(는) 이미 수강 중인 과정입니다. 본인 수강 선택에서 빼 주세요.",
                )

    fee_course = get_or_create_fee_course(db)
    fee = fee_course.price or 0
    # 묶음 할인(10만원 이상 시 1만원)은 강의·상담 금액 합계 기준 — 발송비는 제외.
    subtotal = sum(courses[cid].price or 0 for cid in course_ids) + sum(
        own_courses[cid].price or 0 for cid in own_ids
    )
    discount = BULK_DISCOUNT_AMOUNT if subtotal >= BULK_DISCOUNT_THRESHOLD else 0
    total = subtotal - discount + fee

    bundle_id = secrets.token_urlsafe(16)
    items: list[BundleItem] = []
    # (course, 수용자용 여부) — 마지막 항목에서 할인액을 차감.
    lines = [(courses[cid], True) for cid in course_ids] + [
        (own_courses[cid], False) for cid in own_ids
    ]
    for i, (c, for_inmate) in enumerate(lines):
        amount = (c.price or 0) - (discount if i == len(lines) - 1 else 0)
        order = Order(
            user_id=current_user.id,
            course_id=c.id,
            order_type=(
                OrderType.COUNSELING if c.category == CourseCategory.COUNSELING else OrderType.COURSE
            ),
            payment_method=payload.payment_method,
            amount=amount,
            status=OrderStatus.PENDING,
            bundle_id=bundle_id,
            detention_inmate=for_inmate,
        )
        db.add(order)
        db.flush()
        items.append(BundleItem(order_id=order.id, course_id=c.id, course_title=c.title, amount=amount))
    fee_order = Order(
        user_id=current_user.id,
        course_id=fee_course.id,
        order_type=OrderType.COURSE,
        payment_method=payload.payment_method,
        amount=fee,
        status=OrderStatus.PENDING,
        bundle_id=bundle_id,
        detention_inmate=True,
    )
    db.add(fee_order)
    db.flush()
    items.append(
        BundleItem(
            order_id=fee_order.id,
            course_id=fee_course.id,
            course_title=fee_course.title,
            amount=fee,
        )
    )

    def clean(v: str | None) -> str | None:
        v = (v or "").strip()
        return v or None

    db.add(
        DetentionApplication(
            user_id=current_user.id,
            bundle_id=bundle_id,
            inmate_name=payload.inmate_name.strip(),
            inmate_birth=payload.inmate_birth,
            inmate_number=payload.inmate_number.strip(),
            facility_name=payload.facility_name.strip(),
            postal_code=clean(payload.postal_code),
            address=payload.address.strip(),
            delivery_note=clean(payload.delivery_note),
            contact_phone=payload.contact_phone.strip(),
            certificate_email=current_user.email,
            applicant_relation=payload.applicant_relation.strip(),
            status=DetentionStatus.RECEIVED,
        )
    )
    db.commit()

    return BundleCreateResponse(
        bundle_id=bundle_id,
        subtotal=subtotal + fee,
        discount=discount,
        total=total,
        payment_method=payload.payment_method,
        items=items,
    )


class DetentionMineRow(BaseModel):
    id: int
    bundle_id: str
    status: DetentionStatus
    inmate_name: str
    course_titles: list[str]
    total: int
    paid: bool
    tracking_number: str | None
    created_at: datetime
    materials_sent_at: datetime | None
    learning_confirmed_at: datetime | None
    # 이 시각 이후부터 학습 완료 확인 가능(자료 발송 전이면 None).
    confirm_available_at: datetime | None
    completed_at: datetime | None


@router.get("/my", response_model=list[DetentionMineRow])
def my_detention_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DetentionMineRow]:
    apps = db.scalars(
        select(DetentionApplication)
        .where(DetentionApplication.user_id == current_user.id)
        .order_by(DetentionApplication.id.desc())
    ).all()
    rows: list[DetentionMineRow] = []
    for a in apps:
        pairs = db.execute(
            select(Order, Course)
            .join(Course, Course.id == Order.course_id)
            .where(Order.bundle_id == a.bundle_id)
        ).all()
        paid = any(o.status == OrderStatus.PAID for o, _ in pairs)
        if not paid:
            continue
        rows.append(
            DetentionMineRow(
                id=a.id,
                bundle_id=a.bundle_id,
                status=a.status,
                inmate_name=a.inmate_name,
                course_titles=[
                    c.title
                    for o, c in pairs
                    if o.detention_inmate and c.title != DETENTION_FEE_COURSE_TITLE
                ],
                total=sum(o.amount for o, _ in pairs),
                paid=paid,
                tracking_number=a.tracking_number,
                created_at=a.created_at,
                materials_sent_at=a.materials_sent_at,
                learning_confirmed_at=a.learning_confirmed_at,
                confirm_available_at=_eligible_at(a),
                completed_at=a.completed_at,
            )
        )
    return rows


@router.post("/{application_id}/confirm-learning", response_model=DetentionMineRow)
def confirm_detention_learning(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DetentionMineRow:
    """보호자가 수용자의 학습 완료를 확인한다. 자료 발송 후 7일이 지나야 가능."""
    a = db.get(DetentionApplication, application_id)
    if a is None or a.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="신청을 찾을 수 없습니다.")
    if a.status == DetentionStatus.COMPLETED or a.learning_confirmed_at is not None:
        pass  # 이미 확인/완료 — 멱등
    else:
        if a.status != DetentionStatus.MATERIALS_SENT or a.materials_sent_at is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, detail="아직 교육자료가 발송되지 않았습니다."
            )
        available = _eligible_at(a)
        if available is not None and datetime.now(timezone.utc) < available:
            kst = available.astimezone(KST)
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"교육자료 발송 후 {DETENTION_WAIT_DAYS}일이 지난 뒤 확인할 수 있습니다. "
                    f"({kst.month}월 {kst.day}일 이후)"
                ),
            )
        a.learning_confirmed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(a)
        send_detention_confirmed_notification(
            application_id=a.id, inmate_name=a.inmate_name, buyer_email=current_user.email
        )
    mine = my_detention_applications(db=db, current_user=current_user)
    row = next((r for r in mine if r.id == a.id), None)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="신청을 찾을 수 없습니다.")
    return row


# ---------- admin ---------------------------------------------------------


class AdminDetentionOrder(BaseModel):
    order_id: int
    course_title: str
    amount: int
    status: OrderStatus
    is_fee: bool
    # 신청자(가족) 본인이 함께 결제한 수강/상담 주문 — 수용자 수료증 발급 대상이 아님.
    is_own: bool = False
    document_id: int | None = None
    issue_number: str | None = None
    pdf_url: str | None = None
    pledge_pdf_url: str | None = None


class AdminDetentionRow(BaseModel):
    id: int
    status: DetentionStatus
    created_at: datetime
    buyer_username: str
    buyer_email: str
    inmate_name: str
    inmate_birth: date
    inmate_number: str
    facility_name: str
    postal_code: str | None
    address: str
    delivery_note: str | None
    contact_phone: str
    certificate_email: str
    applicant_relation: str | None
    tracking_number: str | None
    admin_memo: str | None
    materials_sent_at: datetime | None
    learning_confirmed_at: datetime | None
    confirm_available_at: datetime | None
    completed_at: datetime | None
    paid: bool
    total: int
    orders: list[AdminDetentionOrder]


def _admin_row(db: Session, a: DetentionApplication) -> AdminDetentionRow:
    buyer = db.get(User, a.user_id)
    pairs = db.execute(
        select(Order, Course)
        .join(Course, Course.id == Order.course_id)
        .where(Order.bundle_id == a.bundle_id)
        .order_by(Order.id)
    ).all()
    docs = {
        d.order_id: d
        for d in db.scalars(
            select(IssuedDocument).where(
                IssuedDocument.order_id.in_([o.id for o, _ in pairs]),
                IssuedDocument.status != IssuedDocumentStatus.REVOKED,
            )
        ).all()
    }
    orders = []
    for o, c in pairs:
        d = docs.get(o.id)
        orders.append(
            AdminDetentionOrder(
                order_id=o.id,
                course_title=c.title,
                amount=o.amount,
                status=o.status,
                is_fee=c.title == DETENTION_FEE_COURSE_TITLE,
                is_own=not o.detention_inmate,
                document_id=d.id if d else None,
                issue_number=d.issue_number if d else None,
                pdf_url=d.pdf_url if d else None,
                pledge_pdf_url=d.pledge_pdf_url if d else None,
            )
        )
    return AdminDetentionRow(
        id=a.id,
        status=a.status,
        created_at=a.created_at,
        buyer_username=buyer.username if buyer else "",
        buyer_email=buyer.email if buyer else "",
        inmate_name=a.inmate_name,
        inmate_birth=a.inmate_birth,
        inmate_number=a.inmate_number,
        facility_name=a.facility_name,
        postal_code=a.postal_code,
        address=a.address,
        delivery_note=a.delivery_note,
        contact_phone=a.contact_phone,
        certificate_email=a.certificate_email,
        applicant_relation=a.applicant_relation,
        tracking_number=a.tracking_number,
        admin_memo=a.admin_memo,
        materials_sent_at=a.materials_sent_at,
        learning_confirmed_at=a.learning_confirmed_at,
        confirm_available_at=_eligible_at(a),
        completed_at=a.completed_at,
        paid=any(o.status == OrderStatus.PAID for o, _ in pairs),
        total=sum(o.amount for o, _ in pairs),
        orders=orders,
    )


@admin_router.get("", response_model=list[AdminDetentionRow])
def admin_list_detention(
    status_filter: DetentionStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[AdminDetentionRow]:
    stmt = select(DetentionApplication).order_by(DetentionApplication.id.desc()).limit(200)
    if status_filter is not None:
        stmt = stmt.where(DetentionApplication.status == status_filter)
    rows = [_admin_row(db, a) for a in db.scalars(stmt).all()]
    # 결제창만 열었다 닫은 미결제 신청은 관리자 목록에서 제외.
    return [r for r in rows if r.paid or any(o.status == OrderStatus.REFUNDED for o in r.orders)]


class DetentionPatch(BaseModel):
    status: DetentionStatus | None = None
    tracking_number: str | None = Field(default=None, max_length=100)
    admin_memo: str | None = None


@admin_router.patch("/{application_id}", response_model=AdminDetentionRow)
def admin_patch_detention(
    application_id: int,
    payload: DetentionPatch,
    db: Session = Depends(get_db),
) -> AdminDetentionRow:
    a = db.get(DetentionApplication, application_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="신청을 찾을 수 없습니다.")
    data = payload.model_dump(exclude_unset=True)
    if "tracking_number" in data:
        a.tracking_number = (data["tracking_number"] or "").strip() or None
    if "admin_memo" in data:
        a.admin_memo = data["admin_memo"]
    if data.get("status") is not None:
        new = data["status"]
        a.status = new
        now = datetime.now(timezone.utc)
        if new == DetentionStatus.MATERIALS_SENT and a.materials_sent_at is None:
            a.materials_sent_at = now
        if new == DetentionStatus.COMPLETED and a.completed_at is None:
            a.completed_at = now
    db.commit()
    db.refresh(a)
    return _admin_row(db, a)


@admin_router.post(
    "/{application_id}/orders/{order_id}/issue", response_model=AdminDetentionRow
)
def admin_issue_detention_certificate(
    application_id: int,
    order_id: int,
    request: Request,
    db: Session = Depends(get_db),
) -> AdminDetentionRow:
    """과정 1개의 수료증(+서약서)을 수용자 명의로 발급. PDF 변환이 과정당 수~십
    수 초 걸려 요청 하나에 과정 하나씩만 처리한다(프록시 타임아웃 방지)."""
    a = db.get(DetentionApplication, application_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="신청을 찾을 수 없습니다.")
    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None or order.bundle_id != a.bundle_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="주문을 찾을 수 없습니다.")
    if a.learning_confirmed_at is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="보호자의 학습 완료 확인(발송 후 7일 경과 필요)이 있어야 수료증을 발급할 수 있습니다.",
        )
    course = db.get(Course, order.course_id)
    if course is None or course.title == DETENTION_FEE_COURSE_TITLE or not order.detention_inmate:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="수료증 발급 대상이 아닙니다.")
    if order.status != OrderStatus.PAID:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="결제 완료된 주문만 발급할 수 있습니다.")
    existing = db.scalar(
        select(IssuedDocument).where(
            IssuedDocument.order_id == order.id,
            IssuedDocument.status != IssuedDocumentStatus.REVOKED,
        )
    )
    if existing is not None:
        return _admin_row(db, a)

    issued_date = datetime.now(KST).date()
    sequence = reserve_next_sequence(db, cert_course_code(course.title))
    doc = IssuedDocument(
        order_id=order.id,
        user_id=order.user_id,
        document_type=IssuedDocumentType.CERTIFICATE,
        recipient_name=a.inmate_name,
        recipient_birth=a.inmate_birth,
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
        sequence=sequence,
        file_token=doc.access_token,
        recipient_name=a.inmate_name,
        birth_date=a.inmate_birth,
        issued_date=issued_date,
    )
    doc.pdf_url = str(request.url_for("static", path=f"pdfs/{pdf_path.name}"))
    doc.issue_number = issue_number
    try:
        pledge_path = generate_pledge_pdf(
            course_title=course.title,
            file_token=doc.access_token,
            recipient_name=a.inmate_name,
            issued_date=issued_date,
            cert_number=issue_number,
        )
    except Exception:  # noqa: BLE001
        logger.exception("서약서 생성 실패 — 수료증 발급은 계속 진행 (order_id=%s)", order.id)
        pledge_path = None
    if pledge_path is not None:
        doc.pledge_pdf_url = str(request.url_for("static", path=f"pdfs/{pledge_path.name}"))
    db.commit()
    return _admin_row(db, a)


@admin_router.post("/{application_id}/send-certificates")
def admin_send_detention_certificates(
    application_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """수료증 발급을 완료 처리한다. 수료증은 신청자의 마이페이지에서 확인하므로
    완료 처리는 메일 발송 결과와 무관하고, 안내 메일은 계정 이메일로 보내는 부가 기능."""
    a = db.get(DetentionApplication, application_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="신청을 찾을 수 없습니다.")
    if a.learning_confirmed_at is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="보호자의 학습 완료 확인이 아직 없습니다."
        )
    row = _admin_row(db, a)
    course_orders = [
        o for o in row.orders if not o.is_fee and not o.is_own and o.status == OrderStatus.PAID
    ]
    if not course_orders:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="결제 완료된 과정이 없습니다.")
    missing = [o.course_title for o in course_orders if o.pdf_url is None]
    if missing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"아직 수료증이 발급되지 않은 과정이 있습니다: {', '.join(missing)}",
        )
    sent = send_detention_certificates(
        to_email=a.certificate_email,
        inmate_name=a.inmate_name,
        items=[(o.course_title, o.pdf_url or "", o.pledge_pdf_url) for o in course_orders],
    )
    a.status = DetentionStatus.COMPLETED
    a.completed_at = a.completed_at or datetime.now(timezone.utc)
    db.commit()
    return {"emailed": sent}
