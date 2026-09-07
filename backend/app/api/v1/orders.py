import secrets
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.admin import require_admin
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.course import Course, CourseCategory
from app.models.enrollment import Enrollment
from app.models.order import Order, OrderStatus, PaymentMethod
from app.models.user import User
from app.schemas.order import (
    BankTransferConfirm,
    BundleCreateRequest,
    BundleCreateResponse,
    BundleItem,
    BundleTossConfirm,
    OrderCreate,
    OrderResponse,
    TossConfirm,
)

router = APIRouter(prefix="/orders", tags=["orders"])

# "맞춤 강의 찾기" 묶음결제 할인 — 프론트(sentencing/page.tsx)의 BULK_DISCOUNT_*
# 와 반드시 같은 값을 유지할 것(그쪽은 결제 전 미리보기 표시용, 실제 금액은
# 여기 서버 계산이 최종 기준).
BULK_DISCOUNT_THRESHOLD = 100_000
BULK_DISCOUNT_AMOUNT = 10_000


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_enrollment(db: Session, user_id: int, course_id: int) -> None:
    """결제 완료 시 자동으로 수강 등록(enrollment) 생성. 이미 있으면 no-op."""
    existing = db.scalar(
        select(Enrollment).where(
            Enrollment.user_id == user_id,
            Enrollment.course_id == course_id,
        )
    )
    if existing is None:
        db.add(
            Enrollment(
                user_id=user_id,
                course_id=course_id,
                expires_at=_now() + timedelta(days=settings.ENROLLMENT_ACCESS_DAYS),
            )
        )


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Order:
    course = db.get(Course, payload.course_id)
    if course is None or not course.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="강의를 찾을 수 없습니다.")

    # amount 는 클라이언트가 보내지만 반드시 course.price 와 일치해야 함 —
    # 아니면 요청을 조작해 임의 금액(예: 100원)으로 주문을 만들고 그 금액만
    # 실제로 결제한 뒤 정가 강의 수강권을 얻는 금액 위변조가 가능해짐.
    if payload.amount != (course.price or 0):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="결제 금액이 강의 가격과 일치하지 않습니다."
        )

    # 사전결제 — 동일 강의의 PAID 주문이 이미 있으면 중복 차단.
    duplicate_paid = db.scalar(
        select(Order).where(
            Order.user_id == current_user.id,
            Order.course_id == course.id,
            Order.status == OrderStatus.PAID,
        )
    )
    if duplicate_paid is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="이미 결제 완료된 강의입니다.",
        )

    # 무통장입금 PENDING 주문은 동일 강의로 중복 생성을 막는다 — 카드/간편결제와
    # 달리 무통장입금은 관리자가 "실제 입금 내역"과 매칭해 수동으로 확인하는데,
    # 같은 강의로 대기 주문이 여러 건 쌓여 있으면 실제 입금은 1건뿐인데도
    # 여러 건을 착오로 승인해 중복 결제(수강권 정상, 금액만 이상) 처리될 위험이
    # 있다. 카드/토스는 결제 취소·이탈이 흔하고 사용자가 스스로 취소할 방법이
    # 없어(주문 취소는 관리자 전용) 여기서 막으면 재시도 자체가 막혀버리므로
    # 무통장입금에 한해서만 적용한다.
    if payload.payment_method == PaymentMethod.BANK_TRANSFER:
        duplicate_pending_bank = db.scalar(
            select(Order).where(
                Order.user_id == current_user.id,
                Order.course_id == course.id,
                Order.status == OrderStatus.PENDING,
                Order.payment_method == PaymentMethod.BANK_TRANSFER,
            )
        )
        if duplicate_pending_bank is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="이미 입금 대기 중인 주문이 있습니다. 관리자 확인을 기다리거나 문의해 주세요.",
            )

    order = Order(
        user_id=current_user.id,
        course_id=course.id,
        payment_method=payload.payment_method,
        amount=payload.amount,
        status=OrderStatus.PENDING,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.post(
    "/bundle", response_model=BundleCreateResponse, status_code=status.HTTP_201_CREATED
)
def create_order_bundle(
    payload: BundleCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BundleCreateResponse:
    """맞춤 강의 찾기에서 여러 강의를 한 번에 담아 결제 — 10만원 이상이면
    10,000원 할인. 강의별로 기존과 동일하게 개별 Order row 를 만들되(수강등록/
    환불/통계가 전부 "주문 1개 = 강의 1개" 를 가정), 같은 결제 세션임을
    bundle_id 로 묶어 한 번의 결제로 전부 확정/환불할 수 있게 한다.

    할인 금액은 클라이언트가 보내는 값을 신뢰하지 않고 여기서 다시 계산한다
    (create_order 의 amount 위변조 방지 원칙과 동일).
    """
    course_ids = list(dict.fromkeys(payload.course_ids))  # 중복 제거, 순서 유지
    courses = {
        c.id: c
        for c in db.scalars(select(Course).where(Course.id.in_(course_ids))).all()
    }
    missing = [cid for cid in course_ids if cid not in courses]
    if missing:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=f"강의를 찾을 수 없습니다: {missing}"
        )
    for cid in course_ids:
        c = courses[cid]
        if not c.is_active or c.category == CourseCategory.COUNSELING:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"'{c.title}' 은(는) 묶음결제 대상이 아닙니다.",
            )

    for cid in course_ids:
        c = courses[cid]
        duplicate_paid = db.scalar(
            select(Order).where(
                Order.user_id == current_user.id,
                Order.course_id == cid,
                Order.status == OrderStatus.PAID,
            )
        )
        if duplicate_paid is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT, detail=f"'{c.title}' 은(는) 이미 결제 완료된 강의입니다."
            )
        if payload.payment_method == PaymentMethod.BANK_TRANSFER:
            duplicate_pending_bank = db.scalar(
                select(Order).where(
                    Order.user_id == current_user.id,
                    Order.course_id == cid,
                    Order.status == OrderStatus.PENDING,
                    Order.payment_method == PaymentMethod.BANK_TRANSFER,
                )
            )
            if duplicate_pending_bank is not None:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    detail=f"'{c.title}' 은(는) 이미 입금 대기 중인 주문이 있습니다.",
                )

    subtotal = sum(courses[cid].price or 0 for cid in course_ids)
    discount = BULK_DISCOUNT_AMOUNT if subtotal >= BULK_DISCOUNT_THRESHOLD else 0
    total = subtotal - discount

    bundle_id = secrets.token_urlsafe(16)
    items: list[BundleItem] = []
    for i, cid in enumerate(course_ids):
        c = courses[cid]
        # 개별 강의 금액은 원칙적으로 course.price 그대로 유지하되(환불/통계가
        # 강의당 정가를 기준으로 하는 기존 로직과의 정합성), 할인액만큼만 마지막
        # 항목 하나에서 차감해 총합(sum of amounts)이 실제 결제될 total 과
        # 정확히 일치하게 한다.
        amount = (c.price or 0) - (discount if i == len(course_ids) - 1 else 0)
        order = Order(
            user_id=current_user.id,
            course_id=cid,
            payment_method=payload.payment_method,
            amount=amount,
            status=OrderStatus.PENDING,
            bundle_id=bundle_id,
        )
        db.add(order)
        db.flush()
        items.append(
            BundleItem(order_id=order.id, course_id=cid, course_title=c.title, amount=amount)
        )
    db.commit()

    return BundleCreateResponse(
        bundle_id=bundle_id,
        subtotal=subtotal,
        discount=discount,
        total=total,
        payment_method=payload.payment_method,
        items=items,
    )


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

    course_ids = {o.course_id for o in orders}
    course_titles: dict[int, str] = {
        c.id: c.title
        for c in db.scalars(select(Course).where(Course.id.in_(course_ids))).all()
    }

    return [
        OrderResponse(
            id=o.id,
            course_id=o.course_id,
            order_type=o.order_type,
            status=o.status,
            amount=o.amount,
            payment_method=o.payment_method,
            created_at=o.created_at,
            paid_at=o.paid_at,
            course_title=course_titles.get(o.course_id),
            bundle_id=o.bundle_id,
        )
        for o in orders
    ]


@router.post("/{order_id}/cancel", response_model=OrderResponse)
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrderResponse:
    """본인의 결제 대기(무통장입금 등) 주문을 스스로 취소.

    입금 전에는 아직 아무 돈도 오간 게 없으므로 관리자 개입 없이 바로
    취소 가능해야 한다. 묶음결제로 같이 만들어진 주문이면(bundle_id 공유)
    할인 금액이 그 묶음 전체를 기준으로 계산돼 있어 하나만 따로 취소하면
    금액이 안 맞게 되므로, 같은 묶음의 결제 대기 주문을 전부 함께 취소한다.
    """
    order = db.get(Order, order_id)
    if order is None or order.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="주문을 찾을 수 없습니다.")
    if order.status != OrderStatus.PENDING:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="결제 대기 상태의 주문만 취소할 수 있습니다.",
        )

    orders_to_cancel = [order]
    if order.bundle_id:
        orders_to_cancel = list(
            db.scalars(
                select(Order).where(
                    Order.bundle_id == order.bundle_id,
                    Order.status == OrderStatus.PENDING,
                )
            ).all()
        )

    for o in orders_to_cancel:
        o.status = OrderStatus.CANCELLED
    db.commit()
    db.refresh(order)

    course = db.get(Course, order.course_id)
    return OrderResponse(
        id=order.id,
        course_id=order.course_id,
        order_type=order.order_type,
        status=order.status,
        amount=order.amount,
        payment_method=order.payment_method,
        created_at=order.created_at,
        paid_at=order.paid_at,
        course_title=course.title if course else None,
        bundle_id=order.bundle_id,
    )


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

    if not settings.TOSS_SECRET_KEY:
        # 시뮬레이션 모드 — 토스 연동 없이 즉시 paid 처리.
        # 트리거는 오직 서버 자신의 설정(TOSS_SECRET_KEY 미설정)뿐이어야 한다.
        # 예전엔 클라이언트가 보내는 is_simulated 플래그도 OR 조건에 들어있었는데,
        # 그러면 TOSS_SECRET_KEY 가 정상적으로 설정된 운영 환경에서도 아무 로그인
        # 사용자나 이 필드를 true 로 보내기만 하면 실제 결제 없이 주문이 paid
        # 처리되는 결제 우회 구멍이었음(payload는 클라이언트가 전적으로 통제하는
        # 값이라 신뢰 경계로 쓰면 안 됨). 위젯 호출 자체가 없으므로 amount 변조
        # 방어도 의미 없어 검증을 스킵한다.
        _mark_paid(order, payment_key=payload.payment_key or "SIMULATED")
        _ensure_enrollment(db, order.user_id, order.course_id)
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
    _ensure_enrollment(db, order.user_id, order.course_id)
    db.commit()
    db.refresh(order)
    return order


def _with_course_titles(db: Session, orders: list[Order]) -> list[OrderResponse]:
    course_ids = {o.course_id for o in orders}
    titles = {
        c.id: c.title
        for c in db.scalars(select(Course).where(Course.id.in_(course_ids))).all()
    }
    return [
        OrderResponse(
            id=o.id,
            course_id=o.course_id,
            order_type=o.order_type,
            status=o.status,
            amount=o.amount,
            payment_method=o.payment_method,
            created_at=o.created_at,
            paid_at=o.paid_at,
            course_title=titles.get(o.course_id),
        )
        for o in orders
    ]


@router.post("/bundle/toss/confirm", response_model=list[OrderResponse])
def bundle_toss_confirm(
    payload: BundleTossConfirm,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[OrderResponse]:
    """묶음결제 승인 — 토스 결제 1건으로 여러 강의 주문을 한 번에 확정."""
    orders = list(
        db.scalars(select(Order).where(Order.bundle_id == payload.bundle_id)).all()
    )
    if not orders or any(o.user_id != current_user.id for o in orders):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="묶음 주문을 찾을 수 없습니다.")
    if all(o.status == OrderStatus.PAID for o in orders):
        return _with_course_titles(db, orders)
    if any(o.status != OrderStatus.PENDING for o in orders):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="이미 처리된 주문입니다.")

    total = sum(o.amount for o in orders)

    if not settings.TOSS_SECRET_KEY:
        # 단일 주문 확인(toss_confirm)과 동일 원칙 — 서버 설정만이 시뮬레이션
        # 모드 트리거.
        for o in orders:
            _mark_paid(o, payment_key=payload.payment_key or "SIMULATED")
            _ensure_enrollment(db, o.user_id, o.course_id)
        db.commit()
        for o in orders:
            db.refresh(o)
        return _with_course_titles(db, orders)

    if total != payload.amount:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="결제 금액이 일치하지 않습니다.")

    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.post(
                f"{settings.TOSS_API_BASE}/v1/payments/confirm",
                auth=(settings.TOSS_SECRET_KEY, ""),
                json={
                    "paymentKey": payload.payment_key,
                    "orderId": f"KCPEC-BUNDLE-{payload.bundle_id}",
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

    for o in orders:
        _mark_paid(o, payment_key=payload.payment_key)
        _ensure_enrollment(db, o.user_id, o.course_id)
    db.commit()
    for o in orders:
        db.refresh(o)
    return _with_course_titles(db, orders)


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
    _ensure_enrollment(db, order.user_id, order.course_id)

    # 묶음결제의 일부면 같은 입금 1건에 대응하는 나머지 강의 주문들도 함께
    # 확정한다 — 하나씩 따로 확정하게 두면 관리자가 첫 강의만 승인하고 끝내
    # 나머지 강의는 결제 안 된 채로 남는 사고가 나기 쉬웠다.
    if order.bundle_id:
        siblings = db.scalars(
            select(Order).where(
                Order.bundle_id == order.bundle_id,
                Order.id != order.id,
                Order.status == OrderStatus.PENDING,
            )
        ).all()
        for sib in siblings:
            _mark_paid(sib, payment_key=None)
            sib.bank_confirmed_at = _now()
            _ensure_enrollment(db, sib.user_id, sib.course_id)

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
