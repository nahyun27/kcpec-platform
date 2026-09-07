"""배포 직후 조용히 깨져있기 쉬운 서버 의존성을 한 번에 점검.

2026-09 EC2 첫 배포 때 실제로 겪은 문제들 — 앱 코드는 멀쩡한데 서버에
LibreOffice 가 없어서 수료증 발급이 500 으로 죽거나, 한글 폰트가 없어서
PDF 글자가 전부 네모(□)로 깨지거나, SMTP 미설정으로 인증/알림 메일이
아무한테도 안 가는 식 — 를 실사용자가 만나기 전에 관리자가 먼저 알 수
있게 하기 위한 점검 모음. 새 항목이 필요하면 여기에 체크 함수만 추가하면
됨(체크 함수는 항상 HealthItem 하나를 반환).
"""

from __future__ import annotations

import subprocess

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.cert_config import CERT_TEMPLATE_MAP
from app.core.config import settings
from app.core.pdf import TEMPLATES_DIR, _find_soffice
from app.core.storage import _aws_configured
from app.models.course import Course, CourseCategory
from app.schemas.admin import HealthItem


def _ok(name: str, detail: str | None = None) -> HealthItem:
    return HealthItem(name=name, ok=True, detail=detail)


def _fail(name: str, detail: str) -> HealthItem:
    return HealthItem(name=name, ok=False, detail=detail)


def check_database(db: Session) -> HealthItem:
    try:
        db.execute(text("SELECT 1"))
        return _ok("데이터베이스 연결")
    except Exception as e:  # noqa: BLE001 — 점검용, 원인 그대로 노출
        return _fail("데이터베이스 연결", str(e))


def check_libreoffice() -> HealthItem:
    try:
        path = _find_soffice()
        return _ok("PDF 변환(LibreOffice)", path)
    except Exception as e:  # noqa: BLE001
        return _fail("PDF 변환(LibreOffice)", str(e))


def check_korean_fonts() -> HealthItem:
    """fontconfig 로 한글 지원 폰트 존재 여부 확인.
    없으면 LibreOffice 자체는 동작해도 PDF 안의 한글이 네모(□)로 깨진다 —
    2026-09 배포 때 실제로 겪은 문제.
    """
    try:
        result = subprocess.run(
            ["fc-list", ":lang=ko"], capture_output=True, text=True, timeout=5
        )
    except FileNotFoundError:
        return _fail(
            "한글 폰트",
            "fc-list 명령을 찾을 수 없습니다 (fontconfig 미설치) — "
            "PDF 안 한글이 깨질 수 있습니다.",
        )
    except Exception as e:  # noqa: BLE001
        return _fail("한글 폰트", str(e))

    count = len([line for line in result.stdout.splitlines() if line.strip()])
    if count == 0:
        return _fail(
            "한글 폰트",
            "설치된 한글 폰트가 없습니다 — 수료증 PDF 의 한글이 네모(□)로 "
            "깨져서 나옵니다. (Ubuntu: apt-get install fonts-nanum fonts-noto-cjk)",
        )
    return _ok("한글 폰트", f"{count}개 글꼴 확인됨")


def check_cert_templates() -> HealthItem:
    """CERT_TEMPLATE_MAP 에 등록된 PPTX 파일이 실제로 디스크에 있는지 확인."""
    missing = [
        f"{title} → {cfg['file']}"
        for title, cfg in CERT_TEMPLATE_MAP.items()
        if not (TEMPLATES_DIR / cfg["file"]).exists()
    ]
    if missing:
        return _fail(
            "수료증 템플릿 파일",
            f"{len(missing)}개 파일 누락: " + "; ".join(missing),
        )
    return _ok("수료증 템플릿 파일", f"{len(CERT_TEMPLATE_MAP)}개 전체 존재 확인")


def check_cert_coverage(db: Session) -> HealthItem:
    """실제 판매 중인 강의 중 수료증 템플릿 매핑이 없는 강의가 있는지 확인.

    2026-09 에 겪은 근본 문제 — course_id 매핑이 어긋나 엉뚱한 강의명이
    찍히거나(모든 course_id 에 항목은 있었으므로 "파일 존재" 체크만으로는
    못 잡음), 새로 강의를 추가하고 템플릿 등록을 깜빡하는 경우를 잡기 위한
    것. 강의명이 CERT_TEMPLATE_MAP 키와 정확히 일치해야 하므로, 강의 제목을
    바꿨는데 템플릿 쪽을 안 바꾼 경우도 여기서 걸린다.
    """
    active_courses = (
        db.query(Course)
        .filter(Course.is_active.is_(True), Course.category != CourseCategory.COUNSELING)
        .all()
    )
    missing = [c.title for c in active_courses if c.title not in CERT_TEMPLATE_MAP]
    if missing:
        return _fail(
            "수료증 매핑 커버리지",
            f"템플릿 매핑이 없는 활성 강의 {len(missing)}개: " + ", ".join(missing),
        )
    return _ok("수료증 매핑 커버리지", f"활성 강의 {len(active_courses)}개 전부 매핑됨")


def check_s3() -> HealthItem:
    if not _aws_configured():
        return _fail(
            "영상 저장소(S3)",
            "AWS 자격증명/버킷 미설정 — 실제 강의 영상 재생이 불가능합니다.",
        )
    try:
        import boto3

        client = boto3.client(
            "s3",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        client.head_bucket(Bucket=settings.AWS_S3_VIDEO_BUCKET)
        return _ok("영상 저장소(S3)", settings.AWS_S3_VIDEO_BUCKET)
    except Exception as e:  # noqa: BLE001
        return _fail("영상 저장소(S3)", str(e))


def check_smtp() -> HealthItem:
    if not settings.SMTP_HOST:
        return _fail(
            "이메일 발송(SMTP)",
            "미설정 — 회원가입 인증/비밀번호 재설정/수료증 발급 알림/심리상담 "
            "직원 알림 메일이 실제로는 발송되지 않고 서버 로그에만 출력됩니다.",
        )
    return _ok("이메일 발송(SMTP)", f"{settings.SMTP_HOST}:{settings.SMTP_PORT}")


def check_gemini() -> HealthItem:
    if not settings.GEMINI_API_KEY:
        return _fail(
            "AI 초안 생성(Gemini)",
            "미설정 — 심리상담 의견서 초안이 더미 텍스트로 대체됩니다.",
        )
    return _ok(
        "AI 초안 생성(Gemini)",
        "키 설정됨 (실제 유효성은 초안 생성 시도 시에만 확인 가능 — 더미 "
        "초안이 계속 나오면 키가 무효한 것일 수 있습니다)",
    )


def check_toss() -> HealthItem:
    if not settings.TOSS_SECRET_KEY:
        return _fail("결제(토스)", "미설정 — 결제가 시뮬레이션 모드로 동작합니다.")
    mode = "테스트 모드(test_)" if settings.TOSS_SECRET_KEY.startswith("test_") else "실 결제 모드"
    return _ok("결제(토스)", mode)


def run_all_checks(db: Session) -> list[HealthItem]:
    return [
        check_database(db),
        check_libreoffice(),
        check_korean_fonts(),
        check_cert_templates(),
        check_cert_coverage(db),
        check_s3(),
        check_smtp(),
        check_gemini(),
        check_toss(),
    ]
