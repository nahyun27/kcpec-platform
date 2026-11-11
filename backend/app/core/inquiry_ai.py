"""1:1 문의 답변 초안(Gemini).

2026-11 기준 운영 1:1 문의 39건을 분류해 보니 대부분이 "내 결제/수강/서류가
지금 어떤 상태냐"를 묻는 상태 확인형이었다(수료증 위치·재발급, 환불, 의견서
수정, 제출 서류, 가상계좌 입금 반영, 구속수용자 진행 단계 등). 그래서 문의
글만 넘기지 않고 그 회원의 실제 계정 상태를 함께 넘겨 초안을 만든다.

- 초안은 관리자가 검토·수정 후 직접 등록한다. 자동 발송하지 않는다.
- 외부(Google)로 나가는 내용에서 이름·이메일·전화번호·주소는 뺀다.
- 정책이 바뀌면 ANSWER_GUIDE 만 고치면 된다.
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime, timedelta, timezone
from textwrap import dedent

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.community import Post, PostCategory
from app.models.counseling import CounselingSurvey
from app.models.course import Course
from app.models.detention import DetentionApplication
from app.models.document import IssuedDocument, IssuedDocumentStatus
from app.models.enrollment import Enrollment
from app.models.legal_letter import LegalLetter
from app.models.order import Order
from app.models.user import User

logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))


class InquiryAIError(RuntimeError):
    pass


ANSWER_GUIDE = dedent(
    """\
    [말투]
    - 시작: "안녕하세요, 한국범죄예방교육센터입니다." / 끝: "감사합니다."
    - 3~6문장 정도로 짧고 공손하게. 마크다운(**, #, - 목록) 금지, 평문만.
    - 확인되지 않은 사실을 단정하지 말 것. 계정 상태에 없는 내용은 지어내지 말 것.
    - 관리자가 직접 처리해야 하는 일(환불 실행, 수료증 정정, 의견서 수정 등)은
      "처리해 드렸습니다"라고 쓰지 말고 "확인 후 처리해 드리겠습니다"로 쓴다.

    [정책·안내 사실]
    수강
    - 결제 후 30일 동안 수강 가능.
    - 미성년자도 수강 가능.
    - 어떤 강의를 들어야 하는지는 혐의에 따라 다름. 사이트의 '맞춤 강의 찾기'에서
      사건 유형을 고르면 추천됨. 준법의식 강화는 모든 사건 공통 기본 과정.
    - 영상 끊김: 카카오톡·네이버 앱 안 브라우저 대신 크롬 등 기본 브라우저 권장.
    - 진도가 안 넘어감: 새로고침 후 재시도, 계속되면 강의명을 알려 달라고 안내.

    결제·환불
    - 가상계좌(무통장)는 입금이 확인되면 자동으로 수강이 열림.
    - 수강을 시작한(진도가 있는) 강의는 환불 불가. 수강 전 강의는 환불 가능.
    - 묶음 결제 중 일부(예: 탄원서만)도 부분 환불 가능.
    - 환불 후 카드사 취소 문자·반영 시점은 카드사마다 다르므로 카드사에 문의.

    수료증
    - 강의 수강 완료(진도 + 퀴즈 합격) 후 마이페이지 '내 강의실'에서 발급. 주말에도 가능.
    - 이수일은 실제 수강 완료일로 표기됨.
    - 발급 전에 수강자 이름을 직접 입력하는 칸이 있어 가족(예: 자녀) 이름으로 발급 가능.
    - 이름·생년월일을 잘못 입력한 경우 회원이 직접 고칠 수 없음. 정확한 정보를
      받아 관리자가 정정 후 재업로드 → 마이페이지에서 다시 내려받으면 됨.
      (문의에 정확한 정보가 없으면 정확한 이름/생년월일을 알려 달라고 요청)
    - 수료증 메일이 안 보이면 스팸메일함 확인. 마이페이지에서도 받을 수 있음.

    심리상담 의견서
    - 설문 제출 → 담당자 검토 → 완료되면 마이페이지 '전문가 심리상담'에서 다운로드.
    - 심리상담 완료 시 자기성찰 리포트, 교육이수 소감문, CBT 기반 재범방지
      자가진단 검사지, 양형자료 가이드북도 함께 다운로드 가능.
    - CBT 자가진단 검사지는 출력해서 본인이 직접 체크하는 자료. 결과 리포트나
      자동 그래프는 없음. 다른 양형자료와 함께 제출 가능.
    - 어떤 자료를 함께 제출할지는 담당 변호사와 상의 권장. 전부 또는 일부 제출 모두 가능.
    - 사실관계가 틀린 부분은 수정 요청 시 반영해 재업로드. 다만 기본 의견서 형식은
      정해져 있고 법인 명의로 발급(전화 심리상담은 상담사 정보 안내).
    - 조사·재판 일정이 급하면 일정을 알려 주면 최대한 빠르게 처리.

    반성문·탄원서
    - 최종 검토본이 올라가기 전까지 고객이 수정 가능, 이후에는 수정 불가.
    - 강의나 상담 결제 때 추가로 선택해 결제할 수 있음.

    구속수용자 교육
    - 진행: 결제 → 교육자료 우편 발송 → 발송 7일 후 보호자가 '구속수용자 교육
      신청 내역' 페이지에서 '학습 완료 확인' → 관리자가 수료증 발급.
    - 발급된 수료증·서약서는 마이페이지 '내 강의실' 맨 위 또는 신청 내역 페이지에서 바로 다운로드.
    - 구속된 수용자 본인은 심리상담 불가. 가족이 가족 명의로 상담 받는 것은 가능.

    기타
    - 회원가입 이메일 인증 절차는 없음.
    """
)

SYSTEM_PROMPT = dedent(
    """\
    당신은 한국범죄예방교육센터(온라인 범죄예방 교육·심리상담 의견서 서비스)의
    고객 문의 담당자입니다. 회원의 1:1 문의에 대한 답변 초안을 작성합니다.
    아래 [답변 가이드]와 함께 주어지는 [회원 계정 상태]를 근거로, 이 회원의 실제
    상황에 맞게 답하세요. 상태 정보로 답할 수 있으면 구체적으로(예: 어떤 과정의
    수료증이 이미 발급됨) 답하고, 정보가 부족하면 필요한 정보를 정중히 요청하세요.

    반드시 JSON 한 개로만 출력:
    {"draft": "고객에게 보낼 답변 본문", "notes": "관리자만 보는 메모(처리해야 할 일, 확인이 필요한 점, 근거). 없으면 빈 문자열"}

    """
) + "[답변 가이드]\n" + ANSWER_GUIDE


def _d(dt: datetime | None) -> str:
    if dt is None:
        return "-"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(KST).strftime("%Y-%m-%d")


def _v(x) -> str:
    return getattr(x, "value", str(x))


_PHONE = re.compile(r"01[016-9][-\s.]?\d{3,4}[-\s.]?\d{4}")
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def _scrub(text: str) -> str:
    return _EMAIL.sub("[이메일]", _PHONE.sub("[전화번호]", text or ""))


def build_account_context(db: Session, user_id: int | None) -> str:
    """회원의 결제·수강·서류 상태 요약. 이름/연락처/주소는 넣지 않는다."""
    if user_id is None:
        return "(비회원 또는 예전 익명 글 — 계정 정보 없음)"
    user = db.get(User, user_id)
    if user is None:
        return "(회원 정보 없음)"
    lines: list[str] = [f"가입일: {_d(user.created_at)}", f"오늘: {_d(datetime.now(timezone.utc))}"]

    orders = db.scalars(
        select(Order).where(Order.user_id == user_id).order_by(Order.id)
    ).all()
    titles = {
        c.id: c.title
        for c in db.scalars(
            select(Course).where(Course.id.in_({o.course_id for o in orders} or {0}))
        ).all()
    }
    docs_by_order: dict[int, list[IssuedDocument]] = {}
    if orders:
        for d in db.scalars(
            select(IssuedDocument).where(
                IssuedDocument.order_id.in_([o.id for o in orders]),
                IssuedDocument.status != IssuedDocumentStatus.REVOKED,
            )
        ).all():
            docs_by_order.setdefault(d.order_id, []).append(d)

    lines.append("\n[주문 내역]")
    if not orders:
        lines.append("- 없음")
    for o in orders:
        if _v(o.status) in ("pending", "cancelled") and not docs_by_order.get(o.id):
            # 결제창만 열고 나간 미결제 건은 노이즈 — 가상계좌 대기만 남긴다.
            if not (_v(o.status) == "pending" and _v(o.payment_method) == "bank_transfer"):
                continue
        parts = [
            f"- 주문#{o.id} {titles.get(o.course_id, '?')}",
            f"상태={_v(o.status)}",
            f"결제수단={_v(o.payment_method)}",
            f"{o.amount:,}원",
            f"주문일={_d(o.created_at)}",
        ]
        if o.paid_at:
            parts.append(f"결제일={_d(o.paid_at)}")
        if o.bundle_id:
            parts.append("묶음결제")
        if o.detention_inmate:
            parts.append("구속수용자용")
        for d in docs_by_order.get(o.id, []):
            parts.append(
                f"발급서류({_v(d.document_type)} {d.issue_number}, 발급일={_d(d.issued_at)}, "
                f"다운로드={'함' if d.downloaded_at else '안함'})"
            )
        lines.append(" ".join(parts))

    # 수강 진도 — admin_user_enrollments 와 같은 계산을 재사용.
    from app.api.v1.admin import admin_user_enrollments

    lines.append("\n[수강 현황]")
    enrolls = admin_user_enrollments(user_id=user_id, db=db)
    if not enrolls:
        lines.append("- 없음")
    for e in enrolls:
        lines.append(
            f"- {e.course_title}: 진도 {e.overall_progress_pct}%, "
            f"{'수료' if e.is_completed else '미수료'}"
            + (f", 퀴즈 {'합격' if e.quiz_passed else '미합격'}" if e.has_quiz else "")
            + (f", 수강기한 {_d(e.expires_at)}" if e.expires_at else "")
            + (f", 상담설문 {_v(e.survey_status)}" if e.survey_status else "")
            + (f", 수료증 {e.document.issue_number}" if e.document else "")
        )

    surveys = db.scalars(
        select(CounselingSurvey).where(CounselingSurvey.user_id == user_id)
    ).all()
    if surveys:
        lines.append("\n[심리상담 의견서]")
        for s in surveys:
            lines.append(
                f"- 설문제출={_d(s.submitted_at)}, 상태={_v(s.status)}, "
                f"최종본업로드={'됨' if s.final_pdf_url else '안됨'}, 완료일={_d(s.completed_at)}"
            )

    letters = db.scalars(select(LegalLetter).where(LegalLetter.user_id == user_id)).all()
    if letters:
        lines.append("\n[반성문·탄원서]")
        for lt in letters:
            lines.append(
                f"- {_v(lt.letter_type)}: 작성일={_d(lt.created_at)}, "
                f"최종본발급={'됨 ' + _d(lt.released_at) if lt.released_at else '안됨'}"
            )

    apps = db.scalars(
        select(DetentionApplication).where(DetentionApplication.user_id == user_id)
    ).all()
    if apps:
        lines.append("\n[구속수용자 교육 신청]")
        for a in apps:
            lines.append(
                f"- 신청#{a.id}: 상태={_v(a.status)}, 신청일={_d(a.created_at)}, "
                f"자료발송={_d(a.materials_sent_at)}, 학습완료확인={_d(a.learning_confirmed_at)}, "
                f"수료증발급완료={_d(a.completed_at)}"
            )
    return "\n".join(lines)


def _previous_thread(db: Session, post: Post) -> str:
    if post.user_id is None:
        return ""
    prev = db.scalars(
        select(Post)
        .where(
            Post.user_id == post.user_id,
            Post.category == PostCategory.QNA,
            Post.id != post.id,
            Post.created_at <= post.created_at,
        )
        .order_by(Post.id.desc())
        .limit(3)
    ).all()
    if not prev:
        return ""
    out = ["\n[이 회원의 이전 문의(최근순)]"]
    for p in prev:
        out.append(f"- {_d(p.created_at)} 제목: {p.title}\n  질문: {_scrub(p.content)[:400]}")
        if p.admin_reply:
            out.append(f"  우리 답변: {_scrub(p.admin_reply)[:400]}")
    return "\n".join(out)


def generate_inquiry_draft(db: Session, post: Post) -> dict[str, str]:
    if not settings.GEMINI_API_KEY:
        raise InquiryAIError("GEMINI_API_KEY 미설정 — 로컬 환경에서는 AI 초안을 쓸 수 없습니다.")

    contents = (
        f"[회원 계정 상태]\n{build_account_context(db, post.user_id)}\n"
        f"{_previous_thread(db, post)}\n\n"
        f"[이번 문의]\n제목: {post.title}\n내용: {_scrub(post.content)}"
    )

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    last_exc: Exception | None = None
    for attempt in range(2):
        try:
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                ),
            )
            data = json.loads((response.text or "").strip())
            draft = str(data.get("draft") or "").strip()
            if not draft:
                raise InquiryAIError("AI 응답이 비어 있습니다.")
            return {"draft": draft, "notes": str(data.get("notes") or "").strip()}
        except Exception as e:  # noqa: BLE001
            last_exc = e
            logger.warning("문의 초안 생성 실패(%s회차): %s", attempt + 1, e)
            if attempt == 0:
                time.sleep(2)
    raise InquiryAIError(f"AI 초안 생성에 실패했습니다: {last_exc}") from last_exc
