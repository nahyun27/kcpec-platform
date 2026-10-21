"""SMTP 이메일 발송 (직원에게 의견서 초안 전달).

SMTP_HOST 가 비어 있으면 콘솔에 출력하고 성공으로 간주 (로컬 개발 모드).
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from email.utils import make_msgid
from textwrap import dedent

from app.core.config import settings
from app.core.gemini_client import is_content_blocked_draft, is_dummy_draft
from app.core.qr import generate_qr_png

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
    dummy_prefix = (
        "[⚠️ AI 처리 불가 - 내용상 직접 작성 필요] "
        if is_content_blocked_draft(draft_text)
        else "[⚠️ 더미 초안 - AI 자동 생성 실패] "
        if is_dummy_draft(draft_text)
        else ""
    )
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


def send_legal_letter_released(
    *,
    to_email: str,
    recipient_name: str,
    letter_label: str,
    pdf_url: str,
) -> bool:
    subject = f"[KCPEC] {letter_label}가 발급되었습니다"
    body = dedent(
        f"""\
        안녕하세요, {recipient_name} 님.

        신청하신 {letter_label} 검토가 완료되어 발급되었습니다.
        아래 링크 또는 마이페이지에서 PDF 파일을 다운로드하실 수 있습니다.

        다운로드: {pdf_url}

        문의 사항은 admin@kcpec.co.kr 로 보내주세요.

        — 한국범죄예방교육센터 —
        """
    )

    if not (settings.SMTP_HOST and to_email):
        logger.info("[EMAIL DEV MODE] 반성문·탄원서 발급 알림 — 콘솔 출력")
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


def send_lawyer_partner_portal(
    *,
    to_email: str,
    law_firm_name: str,
    lawyer_name: str,
    portal_url: str,
    referral_code: str,
) -> bool:
    """변호사 파트너에게 본인 전용 "마이페이지" 링크 발송 — 그 페이지에서
    본인 추천 코드·QR·누적 소개 건수를 직접 확인할 수 있다. 이 링크는
    토큰 기반 비공개 URL이라 전달받은 분 외에는 알 수 없다. QR은 메일
    본문에도 바로 보이도록 이미지로 임베드한다(2026-10, "메일이 너무
    밋밋하다"는 피드백으로 HTML+인라인 QR 추가) — 클릭해서 전용 페이지로
    넘어가지 않아도 QR을 바로 저장·인쇄할 수 있다. /orders/lawyer-partners/
    portal/{token}/qr 과 동일하게 전부 로컬에서 생성(app.core.qr), 외부
    QR 서비스에 추천 코드를 보내지 않는다."""
    subject = f"[KCPEC] {law_firm_name} {lawyer_name} 변호사님 파트너 안내"
    body = (
        f"안녕하세요, {law_firm_name} {lawyer_name} 변호사님.\n\n"
        f"한국범죄예방교육센터(KCPEC) 변호사 사무실 파트너로 등록되셨습니다.\n"
        f"아래 링크에서 의뢰인께 안내하실 추천 코드와 QR코드, 지금까지의 소개 현황을 "
        f"직접 확인하실 수 있습니다.\n\n"
        f"{portal_url}\n\n"
        f"추천 코드: {referral_code}\n\n"
        f"의뢰인이 결제 시 이 추천 코드를 입력(또는 QR 스캔)하시면 10% 할인이 자동 "
        f"적용됩니다.\n\n"
        f"이 링크는 변호사님께만 전달되는 비공개 링크이니 외부에 공유하지 말아 "
        f"주세요.\n\n"
        f"문의: 010-6377-3325 · admin@kcpec.co.kr\n\n"
        f"— 한국범죄예방교육센터 —\n"
    )

    if not (settings.SMTP_HOST and to_email):
        logger.info("[EMAIL DEV MODE] 변호사 파트너 포털 안내 발송 — 콘솔 출력")
        print("=" * 60)
        print(f"To: {to_email or '(미설정)'}")
        print(f"Subject: {subject}")
        print("-" * 60)
        print(body)
        print("=" * 60)
        return True

    client_url = f"{settings.FRONTEND_BASE_URL}/r/{referral_code}"
    qr_png = generate_qr_png(client_url)
    qr_cid = make_msgid(domain="kcpec.co.kr")[1:-1]

    html = f"""\
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background-color:#0f172a;padding:28px 32px;">
                <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">한국범죄예방교육센터</p>
                <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;letter-spacing:0.05em;">LAWYER PARTNER</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
                  안녕하세요, <strong>{law_firm_name} {lawyer_name}</strong> 변호사님.<br>
                  KCPEC 변호사 사무실 파트너로 등록되셨습니다.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #0f172a;border-radius:16px;margin:24px 0;">
                  <tr>
                    <td align="center" style="padding:24px;">
                      <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;color:#2563eb;text-transform:uppercase;">나의 추천 코드</p>
                      <p style="margin:0 0 16px;font-size:28px;font-weight:800;letter-spacing:0.08em;color:#0f172a;font-family:monospace;">{referral_code}</p>
                      <img src="cid:{qr_cid}" width="160" height="160" alt="추천 코드 QR" style="display:block;margin:0 auto;border-radius:8px;border:1px solid #e2e8f0;">
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 24px;font-size:13px;color:#64748b;line-height:1.6;">
                  의뢰인이 결제 시 이 추천 코드를 입력(또는 QR 스캔)하시면 10% 할인이 자동 적용됩니다.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center">
                      <a href="{portal_url}" style="display:inline-block;background-color:#0f172a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 28px;border-radius:999px;">
                        전용 페이지에서 확인하기 →
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;text-align:center;">
                  이 링크는 변호사님께만 전달되는 비공개 링크이니 외부에 공유하지 말아 주세요.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                  문의 010-6377-3325 · admin@kcpec.co.kr<br>한국범죄예방교육센터
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER or "no-reply@kcpec.kr"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)
    msg.add_alternative(html, subtype="html")
    msg.get_payload()[1].add_related(
        qr_png, maintype="image", subtype="png", cid=f"<{qr_cid}>"
    )
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


WELCOME_MAIL_SUBJECT = "(광고) 회원님, 수료증 준비를 도와드릴게요"


def send_welcome_marketing_mail(*, to_email: str, unsubscribe_url: str) -> bool:
    """가입 다음 날, 아직 결제하지 않은 회원에게 1회 보내는 안내 메일.

    정보통신망법상 광고성 정보라 수신 동의자에게만 보내고, 제목 앞 (광고)
    표시와 수신거부 방법을 반드시 넣는다(2026-10)."""
    sentencing_url = f"{settings.FRONTEND_BASE_URL}/sentencing"
    body = (
        "회원님, 안녕하세요.\n"
        "한국범죄예방교육센터(KCPEC)입니다.\n\n"
        "가입해 주셔서 감사합니다.\n"
        "지금 어려운 시간을 보내고 계실 수도 있겠지만, 이렇게 준비를 시작하신 것만으로도 "
        "충분히 의미 있는 한 걸음입니다.\n\n"
        "사건 유형만 선택하시면 필요한 재범방지교육과 제출 서류를 바로 안내해 드립니다.\n"
        "수강을 마치시면 법원·검찰·경찰에 제출할 수 있는 수료증이 즉시 발급됩니다.\n\n"
        "· 수료증 22,000원부터, 사건별 교육 44,000원\n"
        "· 24시간 언제든 수강, 수료 즉시 PDF 발급\n"
        "· 반성문·탄원서 작성 지원, 전문가 심리상담 의견서\n\n"
        f"내 사건에 맞는 교육 확인하기: {sentencing_url}\n\n"
        "궁금하신 점은 언제든 편하게 연락 주세요.\n\n"
        "모든 수강생 여러분의 앞날을 응원합니다.\n"
        "감사합니다.\n\n"
        "한국범죄예방교육센터 드림\n"
        "010-6377-3325 · admin@kcpec.co.kr\n\n"
        "본 메일은 혜택·안내 메일 수신에 동의하신 회원님께 발송되었습니다.\n"
        f"더 이상 받지 않으시려면 아래 링크에서 수신거부해 주세요.\n{unsubscribe_url}\n"
    )
    html = f"""\
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background-color:#0f172a;padding:24px 32px;">
<p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">한국범죄예방교육센터</p></td></tr>
<tr><td style="padding:32px;color:#334155;font-size:15px;line-height:1.7;">
<p style="margin:0 0 16px;">회원님, 안녕하세요.<br>한국범죄예방교육센터(KCPEC)입니다.</p>
<p style="margin:0 0 16px;">가입해 주셔서 감사합니다.<br>지금 어려운 시간을 보내고 계실 수도 있겠지만, 이렇게 준비를 시작하신 것만으로도 충분히 의미 있는 한 걸음입니다.</p>
<p style="margin:0 0 16px;">사건 유형만 선택하시면 필요한 재범방지교육과 제출 서류를 바로 안내해 드립니다.<br>수강을 마치시면 법원·검찰·경찰에 제출할 수 있는 수료증이 즉시 발급됩니다.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;margin:0 0 24px;"><tr><td style="padding:16px 20px;font-size:14px;color:#334155;line-height:1.9;">
· 수료증 22,000원부터, 사건별 교육 44,000원<br>· 24시간 언제든 수강, 수료 즉시 PDF 발급<br>· 반성문·탄원서 작성 지원, 전문가 심리상담 의견서
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="{sentencing_url}" style="display:inline-block;background-color:#0f172a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 30px;border-radius:999px;">내 사건에 맞는 교육 확인하기</a>
</td></tr></table>
<p style="margin:24px 0 0;">궁금하신 점은 언제든 편하게 연락 주세요.</p>
<p style="margin:16px 0 0;">모든 수강생 여러분의 앞날을 응원합니다.<br>감사합니다.</p>
<p style="margin:16px 0 0;font-weight:700;">한국범죄예방교육센터 드림</p>
<p style="margin:4px 0 0;font-size:13px;color:#64748b;">010-6377-3325 · admin@kcpec.co.kr</p>
</td></tr>
<tr><td style="padding:18px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;line-height:1.6;text-align:center;">
본 메일은 혜택·안내 메일 수신에 동의하신 회원님께 발송되었습니다.<br>
더 이상 받지 않으시려면 <a href="{unsubscribe_url}" style="color:#64748b;">수신거부</a>를 눌러주세요.
</td></tr></table></td></tr></table></body></html>
"""
    if not (settings.SMTP_HOST and to_email):
        logger.info("[EMAIL DEV MODE] 가입 안내(광고) 메일 — 콘솔 출력")
        print("=" * 60)
        print(f"To: {to_email or '(미설정)'}")
        print(f"Subject: {WELCOME_MAIL_SUBJECT}")
        print("-" * 60)
        print(body)
        print("=" * 60)
        return True

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER or "no-reply@kcpec.kr"
    msg["To"] = to_email
    msg["Subject"] = WELCOME_MAIL_SUBJECT
    msg["List-Unsubscribe"] = f"<{unsubscribe_url}>"
    msg.set_content(body)
    msg.add_alternative(html, subtype="html")
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
