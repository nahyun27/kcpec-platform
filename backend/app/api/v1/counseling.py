from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.claude_client import generate_counseling_draft
from app.core.database import SessionLocal, get_db
from app.core.deps import get_current_user
from app.core.email import send_draft_to_staff
from app.models.counseling import CounselingStatus, CounselingSurvey
from app.models.course import Course
from app.models.order import Order, OrderStatus
from app.models.package import DocumentType, Package
from app.models.user import User
from app.schemas.counseling import (
    SurveyResponse,
    SurveyStatusResponse,
    SurveySubmit,
)

router = APIRouter(prefix="/orders", tags=["counseling"])

DRAFTS_DIR = Path(__file__).resolve().parents[3] / "static" / "drafts"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _process_draft(survey_id: int, course_title: str, user_info: dict[str, str]) -> None:
    """Background task: Claude 초안 생성 → 파일 저장 → 직원 메일 발송 → 상태 업데이트.

    리퀘스트 스코프 세션을 못 쓰므로 SessionLocal 로 새 세션을 열어 사용한다.
    """
    with SessionLocal() as db:
        survey = db.get(CounselingSurvey, survey_id)
        if survey is None:
            return

        try:
            draft = generate_counseling_draft(survey.responses, course_title)
        except Exception:  # noqa: BLE001 — 초안 생성 실패는 상태로만 표현
            return

        DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
        draft_path = DRAFTS_DIR / f"{survey.id}.txt"
        draft_path.write_text(draft, encoding="utf-8")

        survey.ai_draft_url = f"/static/drafts/{survey.id}.txt"
        survey.status = CounselingStatus.DRAFT_GENERATED
        db.commit()

        sent = send_draft_to_staff(
            survey_id=survey.id,
            user_info=user_info,
            course_title=course_title,
            survey_responses=survey.responses,
            draft_text=draft,
        )
        if sent:
            survey.status = CounselingStatus.SENT_TO_STAFF
            survey.draft_sent_at = _now()
            db.commit()


@router.post(
    "/{order_id}/survey",
    response_model=SurveyResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_survey(
    order_id: int,
    payload: SurveySubmit,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SurveyResponse:
    order = db.get(Order, order_id)
    if order is None or order.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="주문을 찾을 수 없습니다.")
    if order.status != OrderStatus.PAID:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="결제 완료된 주문에 한해 설문을 제출할 수 있습니다.",
        )

    # 패키지에 counseling 문서 타입이 포함된 경우만 허용
    pkg = db.scalar(
        select(Package)
        .where(Package.id == order.package_id)
        .options(selectinload(Package.documents))
    )
    if pkg is None or not any(
        d.document_type == DocumentType.COUNSELING for d in pkg.documents
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="심리상담 의견서가 포함된 패키지(Standard/Premium)에서만 사용할 수 있습니다.",
        )

    if db.scalar(select(CounselingSurvey).where(CounselingSurvey.order_id == order_id)):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="이미 제출된 설문이 있습니다.",
        )

    survey = CounselingSurvey(
        order_id=order.id,
        user_id=current_user.id,
        responses=payload.responses,
        status=CounselingStatus.SUBMITTED,
    )
    db.add(survey)
    db.commit()
    db.refresh(survey)

    course = db.get(Course, order.course_id)
    user_info = {
        "이름": current_user.username,
        "이메일": current_user.email,
        "주문번호": str(order.id),
    }
    background_tasks.add_task(
        _process_draft,
        survey.id,
        course.title if course else "(강의 정보 없음)",
        user_info,
    )

    return SurveyResponse.model_validate(survey)


@router.get("/{order_id}/survey", response_model=SurveyStatusResponse)
def get_survey_status(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CounselingSurvey:
    order = db.get(Order, order_id)
    if order is None or order.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="주문을 찾을 수 없습니다.")
    survey = db.scalar(select(CounselingSurvey).where(CounselingSurvey.order_id == order_id))
    if survey is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="설문 내역이 없습니다.")
    return survey
