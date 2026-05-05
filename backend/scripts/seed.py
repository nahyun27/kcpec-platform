"""초기 시드 데이터: 강의 11개 + 패키지 3개.

멱등(idempotent) — 이미 존재하면 건너뛴다.
실행: `cd backend && venv/bin/python scripts/seed.py`
"""

from __future__ import annotations

import sys
from pathlib import Path

# 프로젝트 루트(backend/) 를 import 경로에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.models.community import Notice, NoticeCategory  # noqa: E402
from app.models.course import Course, CourseCategory  # noqa: E402
from app.models.package import (  # noqa: E402
    DocumentType,
    Package,
    PackageDocument,
    PackageTier,
)


COURSES: list[tuple[str, CourseCategory, int]] = [
    ("준법의식 강화", CourseCategory.LAW_COMPLIANCE, 55_000),
    ("음주운전 예방", CourseCategory.DRUNK_DRIVING, 110_000),
    ("성범죄 예방", CourseCategory.SEX_OFFENSE, 110_000),
    ("성매매 예방", CourseCategory.PROSTITUTION, 110_000),
    ("디지털 성범죄 예방", CourseCategory.DIGITAL_SEX_OFFENSE, 110_000),
    ("마약 예방", CourseCategory.DRUG, 110_000),
    ("도박 및 도박개장 예방", CourseCategory.GAMBLING, 110_000),
    ("피싱범죄 예방", CourseCategory.PHISHING, 110_000),
    ("사기횡령배임 등 재산범죄 예방", CourseCategory.PROPERTY_CRIME, 110_000),
    ("스토킹범죄 예방", CourseCategory.STALKING, 110_000),
    ("학교폭력 예방", CourseCategory.SCHOOL_VIOLENCE, 110_000),
]

PACKAGES: list[tuple[str, PackageTier, str, list[DocumentType]]] = [
    (
        "Basic",
        PackageTier.BASIC,
        "이수증 단건 발급",
        [DocumentType.CERTIFICATE],
    ),
    (
        "Standard",
        PackageTier.STANDARD,
        "이수증 + 양형자료 가이드",
        [DocumentType.CERTIFICATE, DocumentType.GUIDE],
    ),
    (
        "Premium",
        PackageTier.PREMIUM,
        "이수증 + 가이드 + 심리상담 의견서 + CBT 자료 + 1:1 상담",
        [
            DocumentType.CERTIFICATE,
            DocumentType.GUIDE,
            DocumentType.COUNSELING,
            DocumentType.CBT,
            DocumentType.CONSULTATION,
        ],
    ),
]


def seed_courses() -> int:
    inserted = 0
    with SessionLocal() as db:
        for title, category, price in COURSES:
            exists = db.scalar(select(Course).where(Course.title == title))
            if exists is not None:
                continue
            db.add(
                Course(
                    title=title,
                    description=f"{title} 과정 — 자세한 설명은 추후 업데이트됩니다.",
                    category=category,
                    price=price,
                    is_active=True,
                )
            )
            inserted += 1
        db.commit()
    return inserted


def seed_packages() -> int:
    inserted = 0
    with SessionLocal() as db:
        for name, tier, description, doc_types in PACKAGES:
            exists = db.scalar(select(Package).where(Package.tier == tier))
            if exists is not None:
                continue
            pkg = Package(name=name, tier=tier, price=None, description=description)
            pkg.documents = [PackageDocument(document_type=dt) for dt in doc_types]
            db.add(pkg)
            inserted += 1
        db.commit()
    return inserted


NOTICES: list[tuple[str, NoticeCategory, str, bool]] = [
    (
        "센터 공식 오픈 안내",
        NoticeCategory.NOTICE,
        "한국범죄예방교육센터 온라인 플랫폼이 정식 오픈했습니다. "
        "모든 교육 과정은 무료로 수강하실 수 있으며, 수료 후 양형 자료를 패키지로 발급해 드립니다.",
        True,
    ),
    (
        "추석 연휴 운영 안내",
        NoticeCategory.NOTICE,
        "추석 연휴 기간 중에도 강의 수강은 정상 가능합니다. "
        "심리상담 의견서 발급은 연휴 종료 후 순차 처리되니 양해 부탁드립니다.",
        False,
    ),
    (
        "양형자료 작성 가이드 (PDF)",
        NoticeCategory.RESOURCE,
        "양형자료 제출 시 참고하실 수 있는 가이드입니다. "
        "첨부 파일을 다운로드 받아 활용해 주세요.",
        False,
    ),
]


def seed_notices() -> int:
    inserted = 0
    with SessionLocal() as db:
        for title, category, content, pinned in NOTICES:
            exists = db.scalar(select(Notice).where(Notice.title == title))
            if exists is not None:
                continue
            db.add(
                Notice(
                    title=title,
                    category=category,
                    content=content,
                    is_pinned=pinned,
                )
            )
            inserted += 1
        db.commit()
    return inserted


def main() -> None:
    courses_added = seed_courses()
    packages_added = seed_packages()
    notices_added = seed_notices()
    print(f"강의 추가: {courses_added}개")
    print(f"패키지 추가: {packages_added}개")
    print(f"공지/자료실 추가: {notices_added}개")


if __name__ == "__main__":
    main()
