"""고객 환불 신청 → 관리자 승인(2026-11).

고객이 수강 전 강의를 마이페이지에서 직접 환불 신청하고, 관리자가 승인하면
admin.perform_refund(관리자 환불과 같은 처리: 토스 부분 취소, 묶음 할인 재계산,
수강 등록 삭제)가 실행된다. 토스 가상계좌 결제 건은 신청 때 환불받을 계좌를
받아 토스가 자동 입금하게 한다.

온라인 신청 대상은 강의 상품만이다. 심리상담·반성문·탄원서·구속수용자 교육은
결제 직후 작업이 시작되므로 지금처럼 1:1 문의로 받는다.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.admin import (
    RefundAccount,
    _plan_refund,
    is_toss_virtual_account,
    perform_refund,
)
from app.api.v1.orders import NON_ENROLLABLE_COURSE_TITLES
from app.core.admin import require_admin
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.email import send_refund_requested_to_staff, send_refund_result_to_user
from app.models.course import Course, CourseCategory
from app.models.document import IssuedDocument, IssuedDocumentStatus
from app.models.enrollment import Enrollment, LectureProgress
from app.models.order import Order, OrderStatus, OrderType, PaymentMethod
from app.models.refund_request import RefundRequest, RefundRequestStatus
from app.models.user import User

router = APIRouter(prefix="/orders", tags=["refund-requests"])
admin_router = APIRouter(
    prefix="/admin/refund-requests",
    tags=["admin-refund-requests"],
    dependencies=[Depends(require_admin)],
)

# 토스 은행 숫자 코드 — 환불계좌 입력용(refundReceiveAccount.bank).
REFUND_BANKS: dict[str, str] = {
    "06": "KB국민은행",
    "88": "신한은행",
    "20": "우리은행",
    "81": "하나은행",
    "11": "NH농협은행",
    "12": "지역농축협",
    "03": "IBK기업은행",
    "90": "카카오뱅크",
    "92": "토스뱅크",
    "89": "케이뱅크",
    "71": "우체국",
    "07": "Sh수협은행",
    "23": "SC제일은행",
    "27": "한국씨티은행",
    "31": "iM뱅크(대구)",
    "32": "부산은행",
    "39": "경남은행",
    "34": "광주은행",
    "37": "전북은행",
    "35": "제주은행",
    "02": "KDB산업은행",
    "45": "새마을금고",
    "48": "신협",
    "64": "산림조합",
    "50": "저축은행",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def has_started(db: Session, order: Order) -> bool:
    enrollment = db.scalar(
        select(Enrollment).where(
            Enrollment.user_id == order.user_id, Enrollment.course_id == order.course_id
        )
    )
    if enrollment is None:
        return False
    if enrollment.is_completed:
        return True
    started = db.scalar(
        select(LectureProgress.id)
        .where(
            LectureProgress.enrollment_id == enrollment.id,
            (LectureProgress.watched_seconds > 0) | LectureProgress.is_completed.is_(True),
        )
        .limit(1)
    )
    return started is not None


def pending_request(db: Session, order_id: int) -> RefundRequest | None:
    return db.scalar(
        select(RefundRequest).where(
            RefundRequest.order_id == order_id,
            RefundRequest.status == RefundRequestStatus.PENDING,
        )
    )


def check_eligibility(db: Session, order: Order, course: Course | None = None) -> str | None:
    """온라인 환불 신청이 가능하면 None, 아니면 고객에게 보여줄 사유."""
    if order.status != OrderStatus.PAID:
        return "결제 완료된 주문만 환불 신청할 수 있습니다."
    course = course or db.get(Course, order.course_id)
    if (
        order.order_type != OrderType.COURSE
        or order.detention_inmate
        or course is None
        or course.category == CourseCategory.COUNSELING
        or course.title in NON_ENROLLABLE_COURSE_TITLES
    ):
        return "강의 상품만 온라인으로 환불 신청할 수 있습니다. 1:1 문의로 요청해 주세요."
    # 예전 아임웹 직접 무통장 입금 건은 토스를 거치지 않아 자동 환불이 안 된다.
    if order.payment_method == PaymentMethod.BANK_TRANSFER and not order.toss_payment_key:
        return "이 결제 건은 1:1 문의로 환불을 요청해 주세요."
    enrollment = db.scalar(
        select(Enrollment).where(
            Enrollment.user_id == order.user_id, Enrollment.course_id == order.course_id
        )
    )
    if enrollment is not None and enrollment.expires_at is not None and _now() > _aware(
        enrollment.expires_at
    ):
        return "수강기간이 지난 강의는 환불 신청할 수 없습니다."
    if has_started(db, order):
        return "이미 수강을 시작한 강의는 환불할 수 없습니다."
    issued = db.scalar(
        select(IssuedDocument.id)
        .where(
            IssuedDocument.order_id == order.id,
            IssuedDocument.status != IssuedDocumentStatus.REVOKED,
        )
        .limit(1)
    )
    if issued is not None:
        return "수료증이 발급된 강의는 환불할 수 없습니다."
    return None


# ---------- 고객 ---------------------------------------------------------------


class RefundCheckResponse(BaseModel):
    eligible: bool
    reason: str | None = None
    refund_amount: int = 0
    forfeited_discount: int = 0
    needs_account: bool = False
    banks: dict[str, str] = {}


class RefundRequestCreate(BaseModel):
    reason: str | None = Field(default=None, max_length=500)
    refund_account: RefundAccount | None = None


class RefundRequestOut(BaseModel):
    id: int
    order_id: int
    status: RefundRequestStatus
    expected_amount: int
    reject_reason: str | None
    created_at: datetime
    decided_at: datetime | None


def _own_order(db: Session, order_id: int, user: User) -> Order:
    order = db.get(Order, order_id)
    if order is None or order.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="주문을 찾을 수 없습니다.")
    return order


@router.get("/{order_id}/refund-check", response_model=RefundCheckResponse)
def refund_check(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RefundCheckResponse:
    order = _own_order(db, order_id, current_user)
    if pending_request(db, order.id) is not None:
        return RefundCheckResponse(eligible=False, reason="이미 환불 신청이 접수되어 있습니다.")
    reason = check_eligibility(db, order)
    if reason:
        return RefundCheckResponse(eligible=False, reason=reason)
    plan = _plan_refund(db, order)
    needs_account = is_toss_virtual_account(order)
    return RefundCheckResponse(
        eligible=True,
        refund_amount=plan.amount,
        forfeited_discount=plan.forfeited_discount,
        needs_account=needs_account,
        banks=REFUND_BANKS if needs_account else {},
    )


@router.post("/{order_id}/refund-request", response_model=RefundRequestOut)
def create_refund_request(
    order_id: int,
    payload: RefundRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RefundRequestOut:
    order = _own_order(db, order_id, current_user)
    # 같은 주문에 신청이 동시에 두 번 들어오지 않게 주문 행을 잠근다.
    db.scalar(select(Order).where(Order.id == order.id).with_for_update())
    if pending_request(db, order.id) is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="이미 환불 신청이 접수되어 있습니다.")
    reason = check_eligibility(db, order)
    if reason:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=reason)
    account = payload.refund_account
    if is_toss_virtual_account(order):
        if account is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, detail="환불받으실 계좌 정보를 입력해 주세요."
            )
        if account.bank_code not in REFUND_BANKS:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="은행을 다시 선택해 주세요.")
        digits = account.account_number.replace("-", "").replace(" ", "")
        if not digits.isdigit() or not 6 <= len(digits) <= 20:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, detail="계좌번호는 숫자만 정확히 입력해 주세요."
            )
        account = RefundAccount(
            bank_code=account.bank_code, account_number=digits, holder_name=account.holder_name.strip()
        )
    else:
        account = None

    plan = _plan_refund(db, order)
    req = RefundRequest(
        order_id=order.id,
        user_id=current_user.id,
        status=RefundRequestStatus.PENDING,
        expected_amount=plan.amount,
        reason=(payload.reason or "").strip() or None,
        refund_bank_code=account.bank_code if account else None,
        refund_account_number=account.account_number if account else None,
        refund_holder_name=account.holder_name if account else None,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    course = db.get(Course, order.course_id)
    send_refund_requested_to_staff(
        request_id=req.id,
        username=current_user.username,
        course_title=course.title if course else "?",
        amount=req.expected_amount,
        reason=req.reason,
    )
    return RefundRequestOut.model_validate(req, from_attributes=True)


@router.post("/{order_id}/refund-request/cancel", response_model=RefundRequestOut)
def cancel_refund_request(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RefundRequestOut:
    order = _own_order(db, order_id, current_user)
    req = pending_request(db, order.id)
    if req is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="진행 중인 환불 신청이 없습니다.")
    req.status = RefundRequestStatus.CANCELLED
    req.decided_at = _now()
    _clear_account(req)
    db.commit()
    db.refresh(req)
    return RefundRequestOut.model_validate(req, from_attributes=True)


def _clear_account(req: RefundRequest) -> None:
    # 계좌번호는 처리가 끝나면 보관할 이유가 없어 지운다(은행·예금주만 남김).
    req.refund_account_number = None


# ---------- 관리자 ---------------------------------------------------------------


class AdminRefundRequestRow(BaseModel):
    id: int
    order_id: int
    status: RefundRequestStatus
    username: str
    name: str | None
    course_title: str
    paid_amount: int
    expected_amount: int
    current_amount: int | None  # 지금 승인하면 실제로 돌려줄 금액(대기 건만)
    payment_method: PaymentMethod
    is_virtual_account: bool
    bank_name: str | None
    account_number_masked: str | None
    holder_name: str | None
    reason: str | None
    reject_reason: str | None
    started_since_request: bool
    bundle: bool
    created_at: datetime
    decided_at: datetime | None


def _mask(acct: str | None) -> str | None:
    if not acct:
        return None
    return acct[:3] + "*" * max(0, len(acct) - 6) + acct[-3:]


def _admin_row(db: Session, req: RefundRequest) -> AdminRefundRequestRow:
    order = db.get(Order, req.order_id)
    user = db.get(User, req.user_id)
    course = db.get(Course, order.course_id) if order else None
    is_pending = req.status == RefundRequestStatus.PENDING
    return AdminRefundRequestRow(
        id=req.id,
        order_id=req.order_id,
        status=req.status,
        username=user.username if user else "?",
        name=user.name if user else None,
        course_title=course.title if course else "?",
        paid_amount=order.amount if order else 0,
        expected_amount=req.expected_amount,
        current_amount=(
            _plan_refund(db, order).amount
            if is_pending and order is not None and order.status == OrderStatus.PAID
            else None
        ),
        payment_method=order.payment_method if order else PaymentMethod.CARD,
        is_virtual_account=bool(order and is_toss_virtual_account(order)),
        bank_name=REFUND_BANKS.get(req.refund_bank_code or "", req.refund_bank_code),
        account_number_masked=_mask(req.refund_account_number),
        holder_name=req.refund_holder_name,
        reason=req.reason,
        reject_reason=req.reject_reason,
        started_since_request=bool(is_pending and order is not None and has_started(db, order)),
        bundle=bool(order and order.bundle_id),
        created_at=req.created_at,
        decided_at=req.decided_at,
    )


@admin_router.get("", response_model=list[AdminRefundRequestRow])
def admin_list_refund_requests(
    status_filter: RefundRequestStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[AdminRefundRequestRow]:
    q = select(RefundRequest).order_by(RefundRequest.id.desc()).limit(200)
    if status_filter is not None:
        q = q.where(RefundRequest.status == status_filter)
    return [_admin_row(db, r) for r in db.scalars(q).all()]


def _get_pending(db: Session, request_id: int) -> RefundRequest:
    req = db.scalar(
        select(RefundRequest).where(RefundRequest.id == request_id).with_for_update()
    )
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="환불 신청을 찾을 수 없습니다.")
    if req.status != RefundRequestStatus.PENDING:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="이미 처리된 신청입니다.")
    return req


class AdminApproveBody(BaseModel):
    # 신청 후 고객이 수강을 시작했어도 그대로 환불할 때 true
    force: bool = False


@admin_router.post("/{request_id}/approve", response_model=AdminRefundRequestRow)
def admin_approve_refund_request(
    request_id: int,
    body: AdminApproveBody | None = None,
    db: Session = Depends(get_db),
) -> AdminRefundRequestRow:
    req = _get_pending(db, request_id)
    order = db.get(Order, req.order_id)
    if order is None or order.status != OrderStatus.PAID:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="결제 완료 상태가 아닌 주문입니다.")
    if has_started(db, order) and not (body and body.force):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="신청 후 고객이 수강을 시작했습니다. 그래도 환불하려면 다시 확인해 주세요.",
        )
    account = None
    if is_toss_virtual_account(order):
        if not (req.refund_bank_code and req.refund_account_number and req.refund_holder_name):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="환불계좌 정보가 없습니다.")
        account = RefundAccount(
            bank_code=req.refund_bank_code,
            account_number=req.refund_account_number,
            holder_name=req.refund_holder_name,
        )
    plan_amount = _plan_refund(db, order).amount
    perform_refund(db, order.id, refund_account=account, reason="고객 환불 신청 승인")
    req = db.get(RefundRequest, request_id)
    req.status = RefundRequestStatus.APPROVED
    req.decided_at = _now()
    _clear_account(req)
    db.commit()
    user = db.get(User, req.user_id)
    course = db.get(Course, order.course_id)
    if user is not None:
        send_refund_result_to_user(
            to_email=user.email,
            course_title=course.title if course else "",
            approved=True,
            amount=plan_amount,
            reject_reason=None,
        )
    return _admin_row(db, req)


class AdminRejectBody(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


@admin_router.post("/{request_id}/reject", response_model=AdminRefundRequestRow)
def admin_reject_refund_request(
    request_id: int,
    body: AdminRejectBody,
    db: Session = Depends(get_db),
) -> AdminRefundRequestRow:
    req = _get_pending(db, request_id)
    req.status = RefundRequestStatus.REJECTED
    req.reject_reason = body.reason.strip()
    req.decided_at = _now()
    _clear_account(req)
    db.commit()
    order = db.get(Order, req.order_id)
    user = db.get(User, req.user_id)
    course = db.get(Course, order.course_id) if order else None
    if user is not None:
        send_refund_result_to_user(
            to_email=user.email,
            course_title=course.title if course else "",
            approved=False,
            amount=0,
            reject_reason=req.reject_reason,
        )
    return _admin_row(db, req)
