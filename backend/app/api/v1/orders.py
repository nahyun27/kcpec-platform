import hmac
import secrets
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.core.admin import require_admin
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.email import send_new_order_notification
from app.models.course import Course, CourseCategory
from app.models.enrollment import Enrollment
from app.models.legal_letter import LegalLetterType
from app.models.order import Order, OrderStatus, OrderType, PaymentMethod
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
    TossWebhookPayload,
)

router = APIRouter(prefix="/orders", tags=["orders"])

# 구속수용자 교육 신청(detention.py)의 교육자료·발송비 항목 — 강의가 아니라
# 별도 상품 행(Course, 비공개)으로 두어 매출 통계에서 따로 잡히게 하고, 금액은
# 관리자 강의 관리에서 수정할 수 있다. 수강 등록은 만들지 않는다.
DETENTION_FEE_COURSE_TITLE = "구속수용자 교육자료·발송비"
DETENTION_FEE_DEFAULT = 50_000

# 반성문·탄원서(legal_letters.py) — 심리상담 결제에 함께 담기는 부가 상품.
# 강의가 아니라 별도 상품 행(Course, 비공개)으로 두는 것도 구속수용자 교육
# 자료·발송비와 같은 이유 — 매출 통계 분리 + 관리자 강의 관리에서 가격 수정.
REPENTANCE_LETTER_COURSE_TITLE = "반성문 작성"
PETITION_LETTER_COURSE_TITLE = "탄원서 작성"
LEGAL_LETTER_PRICE_DEFAULT = 10_000

# 수강 등록(Enrollment) 을 만들면 안 되는 비공개 부가 상품 Course 제목 모음.
NON_ENROLLABLE_COURSE_TITLES = {
    DETENTION_FEE_COURSE_TITLE,
    REPENTANCE_LETTER_COURSE_TITLE,
    PETITION_LETTER_COURSE_TITLE,
}

LEGAL_LETTER_COURSE_TITLE_BY_TYPE: dict[LegalLetterType, str] = {
    LegalLetterType.REPENTANCE: REPENTANCE_LETTER_COURSE_TITLE,
    LegalLetterType.PETITION: PETITION_LETTER_COURSE_TITLE,
}


def get_or_create_letter_course(db: Session, letter_type: LegalLetterType) -> Course:
    """반성문·탄원서용 비공개 상품 Course 행을 찾거나 만든다. 구속수용자 교육
    자료·발송비와 같은 이유로 Course 행(비공개)으로 등록 — 매출 통계 분리 +
    관리자 강의 관리에서 가격 수정 가능(legal_letters.py, counseling_purchase.py
    양쪽에서 재사용하므로 순환 임포트를 피하려 여기 orders.py 에 둠)."""
    title = LEGAL_LETTER_COURSE_TITLE_BY_TYPE[letter_type]
    course = db.scalar(select(Course).where(Course.title == title).limit(1))
    if course is None:
        course = Course(
            title=title,
            description="심리상담 결제 시 함께 신청하는 법원 제출용 서식 자동 작성",
            category=CourseCategory.LAW_COMPLIANCE,
            price=LEGAL_LETTER_PRICE_DEFAULT,
            is_active=False,
        )
        db.add(course)
        db.flush()
    return course

# "맞춤 강의 찾기" 묶음결제 할인 — 프론트(sentencing/page.tsx)의 BULK_DISCOUNT_*
# 와 반드시 같은 값을 유지할 것(그쪽은 결제 전 미리보기 표시용, 실제 금액은
# 여기 서버 계산이 최종 기준).
BULK_DISCOUNT_THRESHOLD = 100_000
BULK_DISCOUNT_AMOUNT = 10_000


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_enrollment(
    db: Session, user_id: int, course_id: int, detention_inmate: bool = False
) -> None:
    """결제 완료 시 자동으로 수강 등록(enrollment) 생성/갱신.

    수강기간이 이미 만료된 뒤 재결제한 경우 여기서 no-op 이면 결제만 되고
    여전히 수강 불가 상태로 남는다 — 새 결제 시점부터 수강기간을 다시
    부여한다(2026-09, 버그 감사 중 발견). expires_at 이 None(레거시,
    기간 무제한)인 기존 enrollment 는 건드리지 않는다.
    """
    fee_course = db.get(Course, course_id)
    if fee_course is not None and fee_course.title in NON_ENROLLABLE_COURSE_TITLES:
        # 구속수용자 교육 자료·발송비, 반성문·탄원서 작성 — 강의가 아니라
        # 수강 등록 대상이 아닌 부가 상품 행들.
        return
    if detention_inmate:
        # 구속수용자 교육(우편 자료) 주문은 수용자 명의로 진행되므로 신청자에게 온라인
        # 수강을 열어주지 않는다 — 신청자 본인 수강은 같은 결제에 별도 주문으로 담는다.
        return
    existing = db.scalar(
        select(Enrollment).where(
            Enrollment.user_id == user_id,
            Enrollment.course_id == course_id,
        )
    )
    new_expiry = _now() + timedelta(days=settings.ENROLLMENT_ACCESS_DAYS)
    if existing is None:
        db.add(
            Enrollment(
                user_id=user_id,
                course_id=course_id,
                expires_at=new_expiry,
            )
        )
    elif existing.expires_at is not None and existing.expires_at < new_expiry:
        existing.expires_at = new_expiry


def _enrollment_expired(db: Session, user_id: int, course_id: int) -> bool:
    enrollment = db.scalar(
        select(Enrollment).where(
            Enrollment.user_id == user_id,
            Enrollment.course_id == course_id,
        )
    )
    return (
        enrollment is not None
        and enrollment.expires_at is not None
        and _now() > enrollment.expires_at
    )


# 결제창을 열었다가 그냥 닫거나 이탈하면 서버는 알 방법이 없어 PENDING 주문이
# 그대로 남는다 — 특히 실패 후 재시도할 때마다 새 주문을 또 만들다 보니 같은
# 사람이 짧은 시간에 PENDING 을 여러 개 쌓는 경우가 많았다(2026-09, 실사용
# 데이터에서 확인). 무통장입금(계좌 미발급 상태)은 va_account_number 유무로
# "포기했다"는 확실한 신호가 있어 30분만 지나도 취소해도 안전하지만, 카드/
# 간편결제는 그런 신호가 없어 짧게 잡으면 3DS·앱전환 등으로 오래 걸리는
# 정상 결제 도중 주문이 취소돼버릴 위험이 있다(2026-09, 버그 감사 중 발견 —
# 30분 기준을 결제수단 구분 없이 적용했었음). 그래서 카드/간편결제는 훨씬
# 긴 기준(24시간)으로만 정리한다.
_STALE_PENDING_MINUTES = 30
_STALE_PENDING_HOURS_OTHER = 24


def _cancel_stale_pending(db: Session, user_id: int) -> None:
    cutoff_bank = _now() - timedelta(minutes=_STALE_PENDING_MINUTES)
    cutoff_other = _now() - timedelta(hours=_STALE_PENDING_HOURS_OTHER)
    stale = db.scalars(
        select(Order).where(
            Order.user_id == user_id,
            Order.status == OrderStatus.PENDING,
            or_(
                and_(
                    Order.payment_method == PaymentMethod.BANK_TRANSFER,
                    Order.va_account_number.is_(None),
                    Order.created_at < cutoff_bank,
                ),
                and_(
                    Order.payment_method != PaymentMethod.BANK_TRANSFER,
                    Order.created_at < cutoff_other,
                ),
            ),
        )
    ).all()
    for o in stale:
        o.status = OrderStatus.CANCELLED


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Order:
    _cancel_stale_pending(db, current_user.id)

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

    # 사전결제 — 동일 강의의 PAID 주문이 이미 있으면 중복 차단. 단, 그
    # 수강권의 수강기간이 이미 만료됐다면 재결제로 다시 수강기간을 받을 수
    # 있어야 한다 — 그렇지 않으면 정상적으로 만료된 유료 고객이 다시 결제할
    # 방법이 관리자 문의밖에 없었다(2026-09, 버그 감사 중 발견).
    duplicate_paid = db.scalar(
        select(Order).where(
            Order.user_id == current_user.id,
            Order.course_id == course.id,
            Order.status == OrderStatus.PAID,
            Order.detention_inmate.is_(False),
        )
    )
    if duplicate_paid is not None and not _enrollment_expired(
        db, current_user.id, course.id
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="이미 결제 완료된 강의입니다.",
        )

    # 무통장입금(토스 가상계좌) PENDING 주문 중 "실제로 계좌가 발급된" 것만
    # 중복으로 본다 — 계좌가 이미 발급된 상태에서 또 결제를 시도하면 손님이
    # 계좌 두 개를 헷갈려 이중입금할 위험이 있어 막아야 하지만, 계좌 발급
    # 전에(토스 결제창에서 취소/실패) 남은 PENDING 주문은 애초에 입금받을
    # 계좌 자체가 없어 아무도 거기 입금할 수 없다 — 이런 "빈 시도"까지 막으면
    # 결제 실패 후 재시도 자체가 막혀버린다(2026-09, 실사용 중 발견 — 결제
    # 실패 후 같은 화면에서 바로 재시도가 안 되고 마이페이지 가서 취소부터
    # 해야 했음).
    if payload.payment_method == PaymentMethod.BANK_TRANSFER:
        duplicate_pending_bank = db.scalar(
            select(Order).where(
                Order.user_id == current_user.id,
                Order.course_id == course.id,
                Order.status == OrderStatus.PENDING,
                Order.payment_method == PaymentMethod.BANK_TRANSFER,
                Order.va_account_number.is_not(None),
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
    _cancel_stale_pending(db, current_user.id)

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
        if not c.is_active:
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
                Order.detention_inmate.is_(False),
            )
        )
        if duplicate_paid is not None and not _enrollment_expired(
            db, current_user.id, cid
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT, detail=f"'{c.title}' 은(는) 이미 결제 완료된 강의입니다."
            )
        if payload.payment_method == PaymentMethod.BANK_TRANSFER:
            # 단건결제와 동일한 이유로 실제 계좌가 발급된 주문만 중복으로 본다.
            duplicate_pending_bank = db.scalar(
                select(Order).where(
                    Order.user_id == current_user.id,
                    Order.course_id == cid,
                    Order.status == OrderStatus.PENDING,
                    Order.payment_method == PaymentMethod.BANK_TRANSFER,
                    Order.va_account_number.is_not(None),
                )
            )
            if duplicate_pending_bank is not None:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    detail=f"'{c.title}' 은(는) 이미 입금 대기 중인 주문이 있습니다.",
                )

    # 반성문·탄원서(legal_letters.py) — 함께 선택했으면 같은 묶음결제에 담는다.
    # 할인 기준 금액에도 포함한다(구속수용자 교육 발송비와 달리 여기는
    # "발송비 제외" 같은 예외가 없음 — 전부 통상적인 상품 항목).
    letter_types = list(dict.fromkeys(payload.legal_letters))
    letter_courses = [get_or_create_letter_course(db, LegalLetterType(lt)) for lt in letter_types]

    subtotal = sum(courses[cid].price or 0 for cid in course_ids) + sum(
        c.price or 0 for c in letter_courses
    )
    discount = BULK_DISCOUNT_AMOUNT if subtotal >= BULK_DISCOUNT_THRESHOLD else 0
    total = subtotal - discount

    bundle_id = secrets.token_urlsafe(16)
    items: list[BundleItem] = []
    # course_ids 와 letter_courses 를 하나의 목록으로 합쳐 마지막 항목에서만
    # 할인액을 차감 — 기존 "마지막 항목에서 차감" 규칙을 그대로 유지.
    all_courses = [courses[cid] for cid in course_ids] + letter_courses
    for i, c in enumerate(all_courses):
        amount = (c.price or 0) - (discount if i == len(all_courses) - 1 else 0)
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
        )
        db.add(order)
        db.flush()
        items.append(
            BundleItem(order_id=order.id, course_id=c.id, course_title=c.title, amount=amount)
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
            detention_inmate=o.detention_inmate,
            va_account_number=o.va_account_number,
            va_bank_code=o.va_bank_code,
            va_customer_name=o.va_customer_name,
            va_due_date=o.va_due_date,
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
        if o.va_account_number:
            # 발급된 가상계좌가 있으면 토스 쪽에도 취소를 시도한다(베스트
            # 에포트 — 실패해도 우리 쪽 취소 자체는 막지 않음). 실패하면
            # 실제 계좌는 계속 열려있을 수 있지만, va_secret 을 지워두면
            # 뒤늦게 입금돼 DEPOSIT_CALLBACK 이 와도(아래) 대조 실패로
            # 무시되어 취소된 주문이 되살아나진 않는다.
            if o.toss_payment_key and settings.TOSS_SECRET_KEY:
                try:
                    with httpx.Client(timeout=10.0) as client:
                        client.post(
                            f"{settings.TOSS_API_BASE}/v1/payments/{o.toss_payment_key}/cancel",
                            auth=(settings.TOSS_SECRET_KEY, ""),
                            json={"cancelReason": "고객 주문 취소"},
                        )
                except httpx.HTTPError:
                    pass
            o.va_secret = None
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
        detention_inmate=order.detention_inmate,
        va_account_number=order.va_account_number,
        va_bank_code=order.va_bank_code,
        va_customer_name=order.va_customer_name,
        va_due_date=order.va_due_date,
    )


def _mark_paid(order: Order, payment_key: str | None) -> None:
    order.status = OrderStatus.PAID
    order.paid_at = _now()
    if payment_key:
        order.toss_payment_key = payment_key


def _notify_new_order(db: Session, order: Order) -> None:
    """주문이 방금 PAID 로 확정된 뒤(커밋 이후) 관리자에게 알림 메일 발송.

    SMTP 실패는 send_new_order_notification 내부에서 삼켜지므로 여기서
    예외가 나갈 일은 없다 — 결제 확정 자체를 이 알림 때문에 실패시키지 않는다.
    """
    course = db.get(Course, order.course_id)
    buyer = db.get(User, order.user_id)
    send_new_order_notification(
        order_id=order.id,
        course_title=course.title if course else f"course#{order.course_id}",
        amount=order.amount,
        payment_method=order.payment_method.value,
        buyer_email=buyer.email if buyer else "(알 수 없음)",
        buyer_name=buyer.name if buyer else None,
    )


def _apply_virtual_account(order: Order, payment_key: str, confirm_data: dict) -> None:
    """토스 가상계좌 confirm 응답(status=WAITING_FOR_DEPOSIT)을 주문에 반영.

    실제 입금은 아직 안 됐으므로 PAID 처리는 하지 않는다 — 입금 완료는
    나중에 DEPOSIT_CALLBACK 웹훅(toss_webhook)이 확인해준다. va_secret 은
    그 웹훅을 검증하는 값이라 여기서 반드시 같이 저장해야 한다.

    이 함수가 호출됐다는 것 자체가 "실제로는 가상계좌로 결제됐다"는 확정
    신호다(토스 결제위젯은 체크아웃 페이지에서 카드/기타를 먼저 선택해도
    위젯 안에서 가상계좌 탭으로 바꿀 수 있어, 우리가 처음 저장해둔
    payment_method 와 실제 결제수단이 달라질 수 있다 — 2026-09, 실사용
    건에서 발견: 카드로 기록된 주문이 실제로는 가상계좌 입금으로
    처리됨). 그래서 여기서 실제 확정값으로 덮어써야 관리자 화면의
    결제수단 표시/통계/환불 분기가 정확해진다.
    """
    order.payment_method = PaymentMethod.BANK_TRANSFER
    va = confirm_data.get("virtualAccount") or {}
    order.toss_payment_key = payment_key
    order.va_account_number = va.get("accountNumber")
    order.va_bank_code = va.get("bankCode")
    order.va_customer_name = va.get("customerName")
    due_date = va.get("dueDate")
    order.va_due_date = datetime.fromisoformat(due_date) if due_date else None
    order.va_secret = confirm_data.get("secret")


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
        _ensure_enrollment(db, order.user_id, order.course_id, order.detention_inmate)
        db.commit()
        db.refresh(order)
        _notify_new_order(db, order)
        return order

    # 실 결제 모드 — Toss 위젯이 받은 amount 와 DB amount 가 일치하는지 확인
    if order.amount != payload.amount:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="결제 금액이 일치하지 않습니다.")
    if not payload.payment_key:
        # paymentKey 없이(즐겨찾기/방문기록에 남은 옛 success URL 등) 이
        # 엔드포인트가 호출되면 빈 문자열이 그대로 실 토스 API 로 나가고
        # 있었다 — 프런트에서도 막았지만 서버단 방어도 추가(2026-09, 버그
        # 감사 중 발견).
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="결제 정보가 없습니다.")

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

    data = res.json()
    toss_status = data.get("status")
    just_paid = False
    if toss_status == "DONE":
        _mark_paid(order, payment_key=payload.payment_key)
        _ensure_enrollment(db, order.user_id, order.course_id, order.detention_inmate)
        just_paid = True
    elif toss_status == "WAITING_FOR_DEPOSIT":
        # 가상계좌 발급 완료, 입금 대기 — PAID 처리/수강등록은 입금 완료
        # 웹훅(toss_webhook)에서 한다.
        _apply_virtual_account(order, payload.payment_key, data)
    else:
        # DONE/WAITING_FOR_DEPOSIT 외의 상태(CANCELED/EXPIRED/ABORTED 등)를
        # else 로 뭉쳐서 무조건 PAID 처리하고 있었다 — 실제로 결제가 안 된
        # 상태인데도 수강등록까지 내줄 수 있었던 심각한 구멍이었음
        # (2026-09, 버그 감사 중 발견 및 즉시 수정).
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"결제가 완료되지 않았습니다 (상태: {toss_status}).",
        )
    db.commit()
    db.refresh(order)
    if just_paid:
        _notify_new_order(db, order)
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
            bundle_id=o.bundle_id,
            detention_inmate=o.detention_inmate,
            va_account_number=o.va_account_number,
            va_bank_code=o.va_bank_code,
            va_customer_name=o.va_customer_name,
            va_due_date=o.va_due_date,
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
            _ensure_enrollment(db, o.user_id, o.course_id, o.detention_inmate)
        db.commit()
        for o in orders:
            db.refresh(o)
            _notify_new_order(db, o)
        return _with_course_titles(db, orders)

    if total != payload.amount:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="결제 금액이 일치하지 않습니다.")
    if not payload.payment_key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="결제 정보가 없습니다.")

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

    data = res.json()
    toss_status = data.get("status")
    just_paid = False
    if toss_status == "DONE":
        for o in orders:
            _mark_paid(o, payment_key=payload.payment_key)
            _ensure_enrollment(db, o.user_id, o.course_id, o.detention_inmate)
        just_paid = True
    elif toss_status == "WAITING_FOR_DEPOSIT":
        # 묶음결제 전체가 가상계좌 하나를 공유 — 모든 주문에 같은 계좌 정보를 저장.
        for o in orders:
            _apply_virtual_account(o, payload.payment_key, data)
    else:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"결제가 완료되지 않았습니다 (상태: {toss_status}).",
        )
    db.commit()
    for o in orders:
        db.refresh(o)
        if just_paid:
            _notify_new_order(db, o)
    return _with_course_titles(db, orders)


@router.post("/bank/confirm/{order_id}", response_model=OrderResponse)
def bank_confirm(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Order:
    # 관리자 두 명(또는 같은 관리자의 중복 클릭)이 같은 주문을 거의 동시에
    # 확정하면, 커밋 전까지는 둘 다 status==PENDING 으로 읽어 아래 로직을
    # 중복 실행할 수 있었다(2026-09, 버그 감사 중 발견 — 각 단계가
    # 멱등적이라 실질적 피해는 적지만, row lock 으로 아예 막아둔다). 행
    # 잠금을 걸어 두 번째 요청은 첫 번째가 커밋될 때까지 대기했다가, 이미
    # PAID 로 바뀐 걸 보고 조용히 반환한다.
    order = db.scalar(
        select(Order).where(Order.id == order_id).with_for_update()
    )
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="주문을 찾을 수 없습니다.")
    if order.payment_method != PaymentMethod.BANK_TRANSFER:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="무통장 주문이 아닙니다.")
    if order.status == OrderStatus.PAID:
        return order
    _mark_paid(order, payment_key=None)
    order.bank_confirmed_at = _now()
    _ensure_enrollment(db, order.user_id, order.course_id, order.detention_inmate)

    # 묶음결제의 일부면 같은 입금 1건에 대응하는 나머지 강의 주문들도 함께
    # 확정한다 — 하나씩 따로 확정하게 두면 관리자가 첫 강의만 승인하고 끝내
    # 나머지 강의는 결제 안 된 채로 남는 사고가 나기 쉬웠다.
    siblings: list[Order] = []
    if order.bundle_id:
        siblings = db.scalars(
            select(Order)
            .where(
                Order.bundle_id == order.bundle_id,
                Order.id != order.id,
                Order.status == OrderStatus.PENDING,
            )
            .with_for_update()
        ).all()
        for sib in siblings:
            _mark_paid(sib, payment_key=None)
            sib.bank_confirmed_at = _now()
            _ensure_enrollment(db, sib.user_id, sib.course_id, sib.detention_inmate)

    db.commit()
    db.refresh(order)
    _notify_new_order(db, order)
    for sib in siblings:
        db.refresh(sib)
        _notify_new_order(db, sib)
    return order


# `/bank/confirm` 본문 기반 호출도 지원 (관리자 일괄 처리용 편의)
@router.post("/bank/confirm", response_model=OrderResponse)
def bank_confirm_body(
    payload: BankTransferConfirm,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> Order:
    return bank_confirm(payload.order_id, db=db, _=admin)


@router.post("/webhook/toss", include_in_schema=False)
def toss_webhook(payload: TossWebhookPayload, db: Session = Depends(get_db)) -> dict:
    """토스 가상계좌 입금완료(DEPOSIT_CALLBACK) 웹훅 — 토스가 직접 호출.

    로그인 세션이 없는 서버 대 서버 호출이라 인증 의존성을 두지 않는다.
    토스 개발자센터에 이 URL을 DEPOSIT_CALLBACK 이벤트로만 등록해야 한다
    (PAYMENT_STATUS_CHANGED 도 같이 등록하면 같은 입금건에 웹훅이 두 번 온다).

    웹훅은 상점(MID) 단위로 등록되는데, 같은 MID를 기존 사이트(아임웹)에서도
    이미 실 서비스로 쓰고 있어(API 로그에서 확인, 2026-09) orderId 형식이
    우리 것("KCPEC-{id}"/"KCPEC-BUNDLE-{id}")과 다른 웹훅도 계속 들어온다.
    그런 건 우리 주문이 아니므로 에러 없이 조용히 무시(200)해야 한다 —
    안 그러면 실패 응답 때문에 토스가 최대 7회 재전송을 반복한다.
    """
    order_id_str = payload.orderId
    orders: list[Order] = []
    if order_id_str.startswith("KCPEC-BUNDLE-"):
        bundle_id = order_id_str.removeprefix("KCPEC-BUNDLE-")
        orders = list(
            db.scalars(
                select(Order).where(Order.bundle_id == bundle_id).with_for_update()
            ).all()
        )
    elif order_id_str.startswith("KCPEC-"):
        try:
            order_id = int(order_id_str.removeprefix("KCPEC-"))
        except ValueError:
            order_id = None
        if order_id is not None:
            order = db.scalar(
                select(Order).where(Order.id == order_id).with_for_update()
            )
            orders = [order] if order is not None else []

    if not orders:
        # 우리 시스템 주문이 아니거나(다른 사이트), 이미 지워진 주문 —
        # 어느 쪽이든 우리가 할 일이 없으므로 정상 응답으로 재전송을 끊는다.
        return {"status": "ignored"}

    # va_secret 대조 — HMAC 서명이 아니라 confirm 응답에서 미리 저장해둔
    # 값과의 단순 문자열 비교(토스 DEPOSIT_CALLBACK 검증 방식). 불일치하면
    # 위조/오발신으로 간주하고 아무 상태도 바꾸지 않는다.
    if not orders[0].va_secret or not hmac.compare_digest(orders[0].va_secret, payload.secret):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invalid secret")

    # 웹훅 처리 대상은 항상 "아직 PENDING인 주문"뿐이어야 한다. PAID 는
    # 멱등 처리를 위해 건너뛰지만, 그 외 상태(특히 CANCELLED)는 절대 여기서
    # 다시 건드리면 안 된다 — 예전엔 PAID 만 걸러서, 사용자가 주문을 취소한
    # 뒤에도(가상계좌는 그대로 살아있어 실수/뒤늦게 입금 가능) 늦게 도착한
    # DONE 웹훅이 취소된 주문을 그대로 PAID+수강등록 처리해버릴 수 있었다
    # (2026-09, 버그 감사 중 발견 — 취소를 우회해 무료로 수강권을 얻는 구멍).
    if payload.status == "DONE":
        newly_paid = []
        for o in orders:
            if o.status != OrderStatus.PENDING:
                continue
            _mark_paid(o, payment_key=o.toss_payment_key)
            _ensure_enrollment(db, o.user_id, o.course_id, o.detention_inmate)
            newly_paid.append(o)
        db.commit()
        for o in newly_paid:
            db.refresh(o)
            _notify_new_order(db, o)
    elif payload.status in ("CANCELED", "EXPIRED", "ABORTED"):
        # 가상계좌 입금기한이 지나 토스가 자동으로 계좌를 회수하는 경우 등 —
        # 처리 안 하면 주문이 영원히 PENDING으로 남아 마이페이지에 죽은
        # 계좌 정보가 계속 표시되고, 같은 강의를 무통장입금으로 재주문도
        # 막힌 채로 남는다(2026-09, 버그 감사 중 발견).
        for o in orders:
            if o.status != OrderStatus.PENDING:
                continue
            o.status = OrderStatus.CANCELLED
            o.va_secret = None
        db.commit()

    return {"status": "ok"}
