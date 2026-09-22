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


def send_qna_reply_notification(
    *,
    to_email: str,
    title: str,
    reply: str,
) -> bool:
    subject = f"[KCPEC] 1:1 문의에 답변이 등록되었습니다 - {title}"
    body = dedent(
        f"""\
        안녕하세요.

        남겨주신 1:1 문의 '{title}'에 답변이 등록되었습니다.

        [답변 내용]
        {reply}

        사이트 마이페이지 또는 커뮤니티 게시판에서 전체 내용을 확인하실 수 있습니다.
        추가 문의사항은 admin@kcpec.co.kr 로 보내주세요.

        — 한국범죄예방교육센터 —
        """
    )

    if not (settings.SMTP_HOST and to_email):
        logger.info("[EMAIL DEV MODE] 1:1 문의 답변 알림 — 콘솔 출력")
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
    except Exception as exc:  # noqa: BLE001 — 발송 실패는 호출 측에서 status 로 표현
        logger.exception("SMTP 발송 실패: %s", exc)
        return False
    return True


def send_new_qna_notification(
    *,
    post_id: int,
    title: str,
    author_username: str,
) -> bool:
    """새 1:1 문의가 등록되면 관리자에게 알림 메일 — 답변 페이지 링크 포함."""
    reply_url = f"{settings.FRONTEND_BASE_URL}/admin/community?tab=qna&post={post_id}"
    subject = f"[KCPEC] 새 1:1 문의가 등록되었습니다 - {title}"
    body = dedent(
        f"""\
        새 1:1 문의가 등록되었습니다.

        제목: {title}
        작성자: {author_username}

        아래 링크를 누르면 관리자 페이지의 답변 화면으로 바로 이동합니다.
        {reply_url}

        — KCPEC 플랫폼 —
        """
    )

    if not (settings.SMTP_HOST and settings.STAFF_EMAIL):
        logger.info("[EMAIL DEV MODE] 새 1:1 문의 알림 — 콘솔 출력")
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
    except Exception as exc:  # noqa: BLE001 — 알림 실패가 문의 등록 자체를 막지 않게 삼킨다
        logger.exception("SMTP 발송 실패: %s", exc)
        return False
    return True


def send_new_order_notification(
    *,
    order_id: int,
    course_title: str,
    amount: int,
    payment_method: str,
    buyer_email: str,
    buyer_name: str | None,
) -> bool:
    subject = f"[KCPEC] 새 주문 결제완료 - {course_title} ({amount:,}원)"
    body = dedent(
        f"""\
        새 주문이 결제완료 처리되었습니다.

        주문번호: {order_id}
        상품명: {course_title}
        금액: {amount:,}원
        결제수단: {payment_method}
        구매자: {buyer_name or "(이름 미확인)"} ({buyer_email})

        관리자 페이지에서 자세한 내역을 확인하실 수 있습니다.

        — KCPEC 플랫폼 —
        """
    )

    if not (settings.SMTP_HOST and settings.STAFF_EMAIL):
        logger.info("[EMAIL DEV MODE] 새 주문 알림 — 콘솔 출력")
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


def send_detention_certificates(
    *,
    to_email: str,
    inmate_name: str,
    items: list[tuple[str, str, str | None]],
) -> bool:
    """구속수용자 교육 수료증 발송 — items: (과정명, 수료증 URL, 서약서 URL|None)."""
    subject = f"[KCPEC] {inmate_name}님 구속수용자 교육 수료증이 발급되었습니다"
    lines = []
    for title, pdf_url, pledge_url in items:
        lines.append(f"■ {title}")
        lines.append(f"  수료증: {pdf_url}")
        if pledge_url:
            lines.append(f"  서약서: {pledge_url}")
    body = (
        f"안녕하세요.\n\n"
        f"신청하신 {inmate_name}님의 구속수용자 교육 수료증이 발급되었습니다.\n"
        f"마이페이지 > 결제 내역에서도 확인·다운로드하실 수 있습니다. 아래 링크에서 PDF 파일을 내려받아 인쇄·제출해 주세요.\n\n"
        + "\n".join(lines)
        + "\n\n문의: admin@kcpec.co.kr\n\n— 한국범죄예방교육센터 —\n"
    )

    if not (settings.SMTP_HOST and to_email):
        logger.info("[EMAIL DEV MODE] 구속수용자 수료증 발송 — 콘솔 출력")
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


def send_detention_confirmed_notification(
    *, application_id: int, inmate_name: str, buyer_email: str
) -> bool:
    """보호자가 학습 완료를 확인했음을 관리자에게 알린다(수료증 발급 대기)."""
    subject = f"[KCPEC] 구속수용자 교육 학습 완료 확인 - {inmate_name} (#{application_id})"
    body = dedent(
        f"""\
        보호자가 수용자의 학습 완료를 확인했습니다. 수료증을 발급해 주세요.

        신청번호: {application_id}
        수용자: {inmate_name}
        신청자: {buyer_email}

        관리자 페이지 > 구속수용자 교육에서 수료증 발급 후 이메일을 발송할 수 있습니다.

        — KCPEC 플랫폼 —
        """
    )
    if not (settings.SMTP_HOST and settings.STAFF_EMAIL):
        logger.info("[EMAIL DEV MODE] 구속수용자 학습 완료 알림 — 콘솔 출력")
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
    except Exception as exc:  # noqa: BLE001 — 알림 실패가 확인 처리를 막지 않게 삼킨다
        logger.exception("SMTP 발송 실패: %s", exc)
        return False
    return True
