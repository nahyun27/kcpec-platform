"""SMTP 이메일 발송 (직원에게 의견서 초안 전달).

SMTP_HOST 가 비어 있으면 콘솔에 출력하고 성공으로 간주 (로컬 개발 모드).
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from textwrap import dedent

from app.core.config import settings
from app.core.gemini_client import is_dummy_draft

logger = logging.getLogger(__name__)


def _format_body(
    *,
    survey_id: int,
    user_info: dict[str, str],
    course_title: str,
    survey_responses: dict[str, str],
    draft_text: str,
) -> str:
    user_lines = "\n".join(f"- {k}: {v}" for k, v in user_info.items())
    response_lines = "\n".join(f"- {q}\n  → {a}" for q, a in survey_responses.items())
    return dedent(
        f"""\
        새로운 심리상담 의견서 초안이 도착했습니다.

        ────────────────────────────────────────
        설문 ID: {survey_id}
        교육 과정: {course_title}

        [수강자 정보]
        {user_lines}

        [설문 응답]
        {response_lines}
        ────────────────────────────────────────

        ▼ Claude API 가 생성한 초안 ▼

        {draft_text}

        ────────────────────────────────────────
        관리자 페이지에서 검토 후 최종 의견서를 업로드해 주세요.
        """
    )


def send_final_to_user(
    *,
    to_email: str,
    recipient_name: str,
    pdf_url: str,
) -> bool:
    subject = "[KCPEC] 심리상담 의견서가 발급되었습니다"
    body = dedent(
        f"""\
        안녕하세요, {recipient_name} 님.

        의뢰하신 심리상담 의견서 발급이 완료되었습니다.
        아래 링크에서 PDF 파일을 다운로드 받으실 수 있습니다.

        다운로드: {pdf_url}

        본 의견서는 양형 자료 등으로 활용하실 수 있습니다.
        문의 사항은 admin@kcpec.co.kr 로 보내주세요.

        — 한국범죄예방교육센터 —
        """
    )

    if not (settings.SMTP_HOST and to_email):
        logger.info("[EMAIL DEV MODE] 사용자 발송 — 콘솔 출력")
        print("=" * 60)
        print(f"To: {to_email or '(미설정)'}")
        print(f"Subject: {subject}")
        print("-" * 60)
        print(body)
        print("=" * 60)
        return True

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER or "no-reply@kcpec.kr"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            smtp.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
    except Exception as exc:  # noqa: BLE001
        logger.exception("SMTP 발송 실패: %s", exc)
        return False
    return True


def send_certificate_to_user(
    *,
    to_email: str,
    recipient_name: str,
    course_title: str,
    pdf_url: str,
    pledge_pdf_url: str | None = None,
) -> bool:
    subject = f"[KCPEC] '{course_title}' 수료증이 발급되었습니다"
    pledge_line = f"\n서약서 다운로드: {pledge_pdf_url}\n" if pledge_pdf_url else ""
    body = dedent(
        f"""\
        안녕하세요, {recipient_name} 님.

        '{course_title}' 과정 수료증 발급이 완료되었습니다.
        아래 링크에서 PDF 파일을 다운로드 받으실 수 있습니다.

        다운로드: {pdf_url}
        {pledge_line}
        본 수료증은 양형 자료 등으로 활용하실 수 있습니다.
        문의 사항은 admin@kcpec.co.kr 로 보내주세요.

        — 한국범죄예방교육센터 —
        """
    )

    if not (settings.SMTP_HOST and to_email):
        logger.info("[EMAIL DEV MODE] 수료증 발송 — 콘솔 출력")
        print("=" * 60)
        print(f"To: {to_email or '(미설정)'}")
        print(f"Subject: {subject}")
        print("-" * 60)
        print(body)
        print("=" * 60)
        return True

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER or "no-reply@kcpec.kr"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            smtp.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
    except Exception as exc:  # noqa: BLE001
        logger.exception("SMTP 발송 실패: %s", exc)
        return False
    return True


def send_verification_email(*, to_email: str, verify_url: str) -> bool:
    subject = "[KCPEC] 이메일 인증을 완료해 주세요"
    body = dedent(
        f"""\
        안녕하세요.

        KCPEC 회원가입을 환영합니다. 아래 링크를 눌러 이메일 인증을 완료해 주세요.
        수료증, 심리상담 의견서 등 발급 서류가 이 이메일 주소로 발송되니
        본인 이메일이 맞는지 꼭 확인 부탁드립니다.

        {verify_url}

        본인이 가입하지 않으셨다면 이 메일은 무시하셔도 됩니다.

        — 한국범죄예방교육센터 —
        """
    )

    if not (settings.SMTP_HOST and to_email):
        logger.info("[EMAIL DEV MODE] 이메일 인증 — 콘솔 출력")
        print("=" * 60)
        print(f"To: {to_email or '(미설정)'}")
        print(f"Subject: {subject}")
        print("-" * 60)
        print(body)
        print("=" * 60)
        return True

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER or "no-reply@kcpec.kr"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            smtp.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
    except Exception as exc:  # noqa: BLE001
        logger.exception("SMTP 발송 실패: %s", exc)
        return False
    return True


def send_password_reset_email(*, to_email: str, reset_url: str) -> bool:
    subject = "[KCPEC] 비밀번호 재설정 안내"
    body = dedent(
        f"""\
        안녕하세요.

        비밀번호 재설정을 요청하셨습니다. 아래 링크에서 새 비밀번호를 설정해 주세요.
        (링크는 1시간 동안만 유효합니다)

        {reset_url}

        본인이 요청하지 않으셨다면 이 메일은 무시하셔도 됩니다.

        — 한국범죄예방교육센터 —
        """
    )

    if not (settings.SMTP_HOST and to_email):
        logger.info("[EMAIL DEV MODE] 비밀번호 재설정 — 콘솔 출력")
        print("=" * 60)
        print(f"To: {to_email or '(미설정)'}")
        print(f"Subject: {subject}")
        print("-" * 60)
        print(body)
        print("=" * 60)
        return True

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER or "no-reply@kcpec.kr"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            smtp.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
    except Exception as exc:  # noqa: BLE001
        logger.exception("SMTP 발송 실패: %s", exc)
        return False
    return True


def send_draft_to_staff(
    *,
    survey_id: int,
    user_info: dict[str, str],
    course_title: str,
    survey_responses: dict[str, str],
    draft_text: str,
) -> bool:
    body = _format_body(
        survey_id=survey_id,
        user_info=user_info,
        course_title=course_title,
        survey_responses=survey_responses,
        draft_text=draft_text,
    )
    # 더미 초안(GEMINI_API_KEY 미설정뿐 아니라 키가 유효하지 않거나 API 호출이
    # 실패한 경우도 포함)은 본문에 안내 문구가 섞여 있긴 하지만, 다른 문단들
    # 사이에 묻혀 훑어보다 놓치기 쉽다 — 제목에서부터 눈에 띄게 표시한다.
    # 실제로 더미가 나갔는지는 draft_text 자체로 판단한다(설정값만으로는
    # "키는 있는데 무효/실패"인 경우를 놓친다).
    dummy_prefix = "[⚠️ 더미 초안 - AI 자동 생성 실패] " if is_dummy_draft(draft_text) else ""
    subject = (
        f"[KCPEC] {dummy_prefix}심리상담 의견서 초안 검토 요청 - "
        f"{user_info.get('이름', user_info.get('아이디', '수강자'))}"
    )

    if not (settings.SMTP_HOST and settings.STAFF_EMAIL):
        # 개발 모드 — 콘솔로 출력하고 발송 성공으로 간주
        logger.info(
            "[EMAIL DEV MODE] SMTP_HOST/STAFF_EMAIL 미설정. 콘솔에만 출력합니다."
        )
        print("=" * 60)
        print(f"To: {settings.STAFF_EMAIL or '(STAFF_EMAIL 미설정)'}")
        print(f"Subject: {subject}")
        print("-" * 60)
        print(body)
        print("=" * 60)
        return True

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER or "no-reply@kcpec.kr"
    msg["To"] = settings.STAFF_EMAIL
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            smtp.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
    except Exception as exc:  # noqa: BLE001 — 발송 실패는 호출 측에서 status 로 표현
        logger.exception("SMTP 발송 실패: %s", exc)
        return False
    return True
