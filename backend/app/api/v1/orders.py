from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.admin import require_admin
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.order import Order, OrderStatus, PaymentMethod
from app.models.package import Package
from app.models.user import User
from app.schemas.order import (
    BankTransferConfirm,
    OrderCreate,
    OrderResponse,
    TossConfirm,
)

router = APIRouter(prefix="/orders", tags=["orders"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Order:
    # 강의/패키지 유효성
    course = db.get(Course, payload.course_id)
    if course is None or not course.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="강의를 찾을 수 없습니다.")
    pkg = db.get(Package, payload.package_id)
    if pkg is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="패키지를 찾을 수 없습니다.")

    # 수료 완료 검증
    enrollment = db.scalar(
        select(Enrollment).where(
            Enrollment.user_id == current_user.id,
            Enrollment.course_id == course.id,
        )
    )
    if enrollment is None or not enrollment.is_completed:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="강의 수료(진도+퀴즈) 후에 결제할 수 있습니다.",
        )

    # 동일 course+package 의 PAID 주문이 이미 있으면 중복 차단
    duplicate = db.scalar(
        select(Order).where(
            Order.user_id == current_user.id,
            Order.course_id == course.id,
            Order.package_id == pkg.id,
            Order.status == OrderStatus.PAID,
        )
    )
    if duplicate is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="이미 결제 완료된 주문이 있습니다.",
        )

    order = Order(
        user_id=current_user.id,
        course_id=course.id,
        package_id=pkg.id,
        payment_method=payload.payment_method,
        amount=payload.amount,
        status=OrderStatus.PENDING,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/my", response_model=list[OrderResponse])
def list_my_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[OrderResponse]:
    orders = list(
        db.scalars(
            select(Order)
            .where(Order.user_id == current_user.id)
            .order_by(Order.created_at.desc())
        ).all()
    )
    if not orders:
        return []

    # 한 번의 쿼리로 모든 패키지(+문서 타입) prefetch
    pkg_ids = {o.package_id for o in orders if o.package_id is not None}
    pkg_doc_types: dict[int, list] = {}
    pkg_names: dict[int, str] = {}
    if pkg_ids:
        for pkg in db.scalars(
            select(Package)
            .where(Package.id.in_(pkg_ids))
            .options(selectinload(Package.documents))
        ).all():
            pkg_doc_types[pkg.id] = [d.document_type for d in pkg.documents]
            pkg_names[pkg.id] = pkg.name

    # 강의 제목도 한 번에 prefetch
    course_ids = {o.course_id for o in orders}
    course_titles: dict[int, str] = {
        c.id: c.title
        for c in db.scalars(select(Course).where(Course.id.in_(course_ids))).all()
    }

    out: list[OrderResponse] = []
    for o in orders:
        out.append(
            OrderResponse(
                id=o.id,
                course_id=o.course_id,
                package_id=o.package_id,
                order_type=o.order_type,
                status=o.status,
                amount=o.amount,
                payment_method=o.payment_method,
                created_at=o.created_at,
                paid_at=o.paid_at,
                package_document_types=pkg_doc_types.get(o.package_id or -1, []),
                course_title=course_titles.get(o.course_id),
                package_name=pkg_names.get(o.package_id) if o.package_id else None,
            )
        )
    return out


def _mark_paid(order: Order, payment_key: str | None) -> None:
    order.status = OrderStatus.PAID
    order.paid_at = _now()
    if payment_key:
        order.toss_payment_key = payment_key


@router.post("/toss/confirm", response_model=OrderResponse)
def toss_confirm(
    payload: TossConfirm,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Order:
    order = db.get(Order, payload.order_id)
    if order is None or order.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="주문을 찾을 수 없습니다.")
    if order.status == OrderStatus.PAID:
        return order
    if order.status != OrderStatus.PENDING:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="이미 처리된 주문입니다.")

    if payload.is_simulated or not settings.TOSS_SECRET_KEY:
        # 시뮬레이션 모드 — 토스 연동 없이 즉시 paid 처리.
        # 트리거: TOSS_SECRET_KEY 미설정 OR 프론트가 명시적으로 is_simulated=true.
        # 위젯 호출 자체가 없으므로 amount 변조 방어 의미 없음 → 검증 스킵.
        _mark_paid(order, payment_key=payload.payment_key or "SIMULATED")
        db.commit()
        db.refresh(order)
        return order

    # 실 결제 모드 — Toss 위젯이 받은 amount 와 DB amount 가 일치하는지 확인
    if order.amount != payload.amount:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="결제 금액이 일치하지 않습니다.")

    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.post(
                f"{settings.TOSS_API_BASE}/v1/payments/confirm",
                auth=(settings.TOSS_SECRET_KEY, ""),
                json={
                    "paymentKey": payload.payment_key,
                    # 위젯 호출 시 사용한 형식과 동일해야 confirm 이 통과.
                    "orderId": f"KCPEC-{order.id}",
                    "amount": payload.amount,
                },
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail=f"결제 게이트웨이 호출에 실패했습니다: {exc!s}",
        ) from exc

    if res.status_code != 200:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"토스 결제 승인 실패: {res.text}",
        )

    _mark_paid(order, payment_key=payload.payment_key)
    db.commit()
    db.refresh(order)
    return order


@router.post("/bank/confirm/{order_id}", response_model=OrderResponse)
def bank_confirm(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Order:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="주문을 찾을 수 없습니다.")
    if order.payment_method != PaymentMethod.BANK_TRANSFER:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="무통장 주문이 아닙니다.")
    if order.status == OrderStatus.PAID:
        return order
    _mark_paid(order, payment_key=None)
    order.bank_confirmed_at = _now()
    db.commit()
    db.refresh(order)
    return order


# `/bank/confirm` 본문 기반 호출도 지원 (관리자 일괄 처리용 편의)
@router.post("/bank/confirm", response_model=OrderResponse)
def bank_confirm_body(
    payload: BankTransferConfirm,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> Order:
    return bank_confirm(payload.order_id, db=db, _=admin)
