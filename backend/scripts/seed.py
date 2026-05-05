"""초기 시드 데이터.

강의 11개 + 패키지 3개 + 커뮤니티(공지/자료실/Q&A/칼럼/후기).
멱등(idempotent) — 제목으로 중복 검사 후 없을 때만 insert.

실행: `cd backend && venv/bin/python scripts/seed.py`
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

# 프로젝트 루트(backend/) 를 import 경로에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.models.community import Notice, NoticeCategory, Post, PostCategory  # noqa: E402
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
        "이수증 + 양형자료 가이드 + 심리상담 의견서",
        [DocumentType.CERTIFICATE, DocumentType.GUIDE, DocumentType.COUNSELING],
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


def _utc(year: int, month: int, day: int) -> datetime:
    return datetime(year, month, day, 9, 0, tzinfo=timezone.utc)


# ---------- notices / resources ---------------------------------------------

NOTICES: list[dict] = [
    {
        "title": "강의 업데이트 예정 공지",
        "category": NoticeCategory.NOTICE,
        "author_name": "탈퇴한 회원",
        "is_pinned": False,
        "view_count": 289,
        "created_at": _utc(2024, 4, 2),
        "content": (
            "안녕하세요. 한국범죄예방교육센터입니다. "
            "빠른 시일 내에 강의 업데이트 예정이오니 잘 부탁드립니다."
        ),
    },
    {
        "title": "기업체, 공공기관 등 단체 수강 안내",
        "category": NoticeCategory.NOTICE,
        "author_name": "한국범죄예방교육센터",
        "is_pinned": True,
        "view_count": 270,
        "created_at": _utc(2024, 9, 3),
        "content": """안녕하십니까.
한국범죄예방교육센터입니다.

기업체 또는 공공기관, 학교 등에서 단체 교육을 원하실 경우,
1) 단체명
2) 수강인원
3) 수강 일자(평일, 주말, 시간대)
4) 수강 장소(출강의 경우 출강 지역, 줌미팅 or 구글미팅 등 실시간 온라인 수강 여부)
5) 교육 시간
6) 교육 내용(구체적 주제)
에 대해 알려주시면 답변을 드리도록 하겠습니다.

출강 강사는 법조계 종사자 또는 범죄심리상담사 등이며, 교육내용에 따라 강의 준비 시간이 필요할 수 있으니 시간적 여유를 두고 연락주시기 바랍니다. 감사합니다.""",
    },
    {
        "title": "반성문, 탄원서 작성 방법(양식 무료 다운로드)",
        "category": NoticeCategory.RESOURCE,
        "author_name": "한국범죄예방교육센터",
        "is_pinned": False,
        "view_count": 1214,
        "created_at": _utc(2024, 5, 20),
        "content": """[반성문, 탄원서 작성하는 방법]

양형자료를 준비할 때 가장 먼저 생각하는 것이 반성문(본인 작성), 탄원서(가족, 친구 등 작성) 등일 것입니다.

그런데 막상 반성문이나 탄원서를 작성하려고 하면 어떤 내용을 어떠한 형식으로 작성해야 하는지 막막하게 마련입니다.

먼저 반성문이나 탄원서를 작성할 때에는 피해자가 있는 범죄인지 그렇지 않은 범죄인지 구분하여야 합니다.

그리고 형식보다는 내용에 중점을 두고, 진정성 있는 내용으로 현재 본인이 얼마나 반성하고 있는지, 피해자에게 얼마나 죄송한 마음을 가지고 있는지, 피해 회복을 위해 어떠한 노력을 하고 있는지, 재범하지 않기 위해 앞으로 어떻게 노력할 것인지 등을 솔직하게 작성해야 합니다.

반성문이나 탄원서의 양이나 갯수에 신경쓰기보다는, 하나를 작성하더라도 진심이 담겨 있어야 처분하는 사람의 마음을 움직일 수 있습니다.

<반성문>
1. 범행에 대한 반성
- 모든 잘못을 인정하고 반성한다는 점
- 피해자가 있다면 피해자에 대한 사과 포함
2. 사건의 원인이 된 본인의 문제점 및 사건의 경위
3. 이 사건 범행 이후의 사정
- 피해자가 있다면 피해 회복을 위해 어떠한 노력을 하고 있는지
4. 향후 재발 방지 대책 및 각오
5. 선처 호소

<탄원서>
1. 피의자(피고인)의 범행에 대한 사과
- 피해자가 있다면 피해자에 대한 사과 포함
2. 이 사건 범행을 알게 되었을 때의 심정
3. 이 사건 범행을 예방하지 못한 데 대한 반성
4. 향후 재발 방지 대책 및 각오
5. 마무리 사과 및 선처 탄원""",
    },
]


# ---------- Q&A (기존 FAQ 답변을 그대로 본문으로 사용) -----------------------

QNA: list[dict] = [
    {
        "title": "수강을 완료하고 이틀이 넘게 지났는데 수료증을 못받았어요?",
        "content": "수료증은 수강 내역 확인 후 익일 24시까지 가입하신 이메일을 통해 PDF로 발송됩니다. "
                   "이틀이 넘게 발송되지 않았다면 admin@kcpec.co.kr 로 가입 이메일과 함께 문의해 주시면 즉시 확인 후 재발송해 드리겠습니다.",
    },
    {
        "title": "구치소에 수감되어 있는 수감자도 수강이 가능한가요?",
        "content": "구치소·교도소 내에서는 인터넷 사용이 제한되어 본 사이트를 통한 직접 수강은 어렵습니다. "
                   "가족이 대리로 회원가입하여 수강한 후 발급된 수료증을 영치하시는 방식으로 활용하시는 분들이 많습니다.",
    },
    {
        "title": "미성년자도 수강이 가능한가요?",
        "content": "미성년자도 수강 가능합니다. 다만 결제 및 양형 자료 발급은 법정대리인의 동의가 필요할 수 있으니 사전에 admin@kcpec.co.kr 로 문의해 주세요.",
    },
    {
        "title": "발급받은 서류의 진위 확인이 가능한가요?",
        "content": "네 가능합니다. 저희 센터에서 발급하는 서류는 워터마크가 삽입되어 있으며 문서일련번호로 진위 확인이 가능합니다.\n"
                   "서류의 진위확인을 원하시는 경우, 서류 사본과 문의하실 내용을 적어 admin@kcpec.co.kr로 이메일 문의를 주시면 답변드립니다.",
    },
    {
        "title": "양형자료만 내면 무조건 감형이 되는 건가요?",
        "content": "그렇지 않습니다. 검찰이나 법원의 양형판단은 다양한 요소들을 바탕으로 종합적으로 이루어지기 때문입니다.\n"
                   "다만 수료증, 상담 의견서 등 양형자료는 재범예방교육 또는 심리상담을 통해 피고인(또는 피의자)이 재범하지 않을 것을 굳게 다짐하고 있다는 사정을 경찰, 검찰이나 법원에 알리는 효과적인 방법이 될 수 있습니다.",
    },
    {
        "title": "발급받은 서류를 법원이나 수사기관에 제출해도 되나요?",
        "content": "네, 저희 센터에서 발급한 수료증, 상담 의견서, 서약서 등 자료는 법원이나 수사기관, 학교 등 공공기관에 제출하셔도 됩니다.",
    },
    {
        "title": "상담 절차는 어떻게 진행되나요",
        "content": "기본 상담 절차는 이용자가 상담 설문지를 작성하여 제출하는 서면상담 방식으로 진행됩니다.\n"
                   "심화상담은 의뢰를 하실 경우 상담사와 일정을 맞춘 후 상담사가 해당 시간에 이용자에게 전화를 드리거나 대면상담을 진행합니다.\n"
                   "모든 상담이 종료된 후 24시간 이내에 상담의견서 등을 pdf파일로 가입하신 이메일로 보내드립니다.",
    },
    {
        "title": "사건에 대한 변호사 상담을 받을 수 있나요",
        "content": "본 센터는 변호사 소개나 알선, 상담을 제공하지 않습니다.",
    },
    {
        "title": "수료증 또는 상담의견서 등은 언제 어떻게 받을 수 있나요?",
        "content": "수강자가 강의를 수강한 내역이 확인되면 익일 24시까지 가입하신 이메일을 통해 pdf파일로 보내드립니다.\n"
                   "상담의견서는 상담 후 24시간 이내에 가입하신 이메일을 통해 pdf파일로 보내드립니다.",
    },
    {
        "title": "수료증을 재발급 받을 수 있나요?",
        "content": "수료증을 재발급 받기 위해서는 법령에 따른 개인정보 보관 기간 내에 admin@kcpec.co.kr 이메일로 문의주시면 1회에 한하여 재발급해드립니다.",
    },
    {
        "title": "환불 및 취소가 가능한가요?",
        "content": "결제 오류에 대한 환불이나 취소는 가능하나, 강의 수강 시작 후 또는 상담 의뢰 후 환불이나 취소는 불가합니다.",
    },
]


# ---------- 전문가 칼럼 -------------------------------------------------------
# 본문은 운영자가 실제 칼럼 텍스트로 교체할 placeholder. 제목과 키워드만 신뢰 가능.
COLUMN_PLACEHOLDER_NOTE = "(본 칼럼은 시드 더미 텍스트입니다. 관리자 페이지에서 실제 본문으로 교체해 주세요.)\n\n"

COLUMNS: list[dict] = [
    {
        "title": "피의자 성추행이 무혐의면 피해자는 무고죄?",
        "created_at": _utc(2024, 4, 2),
        "content": COLUMN_PLACEHOLDER_NOTE + (
            "성추행 사건에서 피의자가 무혐의 처분을 받았다고 해서 곧바로 피해자가 무고죄로 처벌되는 것은 아닙니다. "
            "대법원 2019도2614 판례는 무고죄 성립을 위해서는 신고 내용이 객관적으로 허위라는 점이 적극적으로 증명되어야 한다고 판시하였습니다."
        ),
    },
    {
        "title": "길 위의 무법자 - 난폭운전",
        "created_at": _utc(2024, 4, 25),
        "content": COLUMN_PLACEHOLDER_NOTE + (
            "도로교통법은 난폭운전을 별도 처벌 규정으로 두어 다른 운전자나 보행자에게 위해를 가한 경우 강하게 처벌하고 있습니다. "
            "난폭운전이 적발되면 형사처벌과 함께 운전면허 정지·취소 행정처분이 부과됩니다."
        ),
    },
    {
        "title": "카메라등이용촬영죄",
        "created_at": _utc(2024, 5, 15),
        "content": COLUMN_PLACEHOLDER_NOTE + (
            "성폭력처벌법 제14조의 카메라등이용촬영죄는 신체를 그 의사에 반하여 촬영하거나 이를 유포한 경우 성립합니다. "
            "최근 판례는 촬영 자체뿐 아니라 저장·전송·공유 행위까지 폭넓게 처벌하는 경향을 보이고 있습니다."
        ),
    },
    {
        "title": "아동·청소년 성보호에 관한 법률 개정 - '온라인 그루밍' 처벌",
        "created_at": _utc(2024, 6, 10),
        "content": COLUMN_PLACEHOLDER_NOTE + (
            "아동·청소년의 성보호에 관한 법률이 개정되면서, 온라인상에서 신뢰관계를 형성하여 성적 침해를 시도하는 이른바 '그루밍' 행위가 별도 처벌 대상이 되었습니다. "
            "성적 의도를 가진 접근만으로도 처벌될 수 있는 만큼 각별한 주의가 필요합니다."
        ),
    },
    {
        "title": "성범죄와 무고죄",
        "created_at": _utc(2024, 7, 1),
        "content": COLUMN_PLACEHOLDER_NOTE + (
            "성범죄 사건에서 무고죄 고소가 함께 이루어지는 경우가 늘고 있습니다. "
            "다만 무고죄는 객관적 허위성이 적극 증명되어야 하므로 단순히 무혐의·무죄 결과만으로는 성립하지 않는다는 점을 유의해야 합니다."
        ),
    },
    {
        "title": "알코올 블랙아웃(black out) 상태에서 성관계",
        "created_at": _utc(2024, 7, 20),
        "content": COLUMN_PLACEHOLDER_NOTE + (
            "알코올로 인한 의식 소실(블랙아웃) 상태에서의 성관계는 동의 능력의 부재로 보아 준강간으로 판단될 수 있습니다. "
            "음주 정도, 행위 당시 의식 상태, 사후 기억 여부 등이 종합적으로 평가됩니다."
        ),
    },
    {
        "title": "형종상향 금지의 원칙",
        "created_at": _utc(2024, 8, 10),
        "content": COLUMN_PLACEHOLDER_NOTE + (
            "대법원 2019도15700 판결은 항소심에서 검사만이 항소한 사건에서도 형종상향 금지의 원칙(불이익변경 금지)이 적용된다는 점을 다시 확인하였습니다. "
            "피고인의 방어권 보장이라는 형사소송 원칙의 핵심을 보여 주는 판례입니다."
        ),
    },
    {
        "title": "양형판단은 판사 마음대로?",
        "created_at": _utc(2024, 9, 3),
        "content": COLUMN_PLACEHOLDER_NOTE + (
            "대법원 2015도3260 판결은 양형이 법관의 재량 영역이지만 양형기준·동종 사건과의 균형·구체적 사정을 종합적으로 고려해야 한다고 판시했습니다. "
            "단순한 자의(恣意) 가 아니라 합리적 근거에 따른 판단이 요구됨을 분명히 한 판례입니다."
        ),
    },
]


# ---------- 수강 후기 ---------------------------------------------------------

REVIEWS: list[dict] = [
    ("음주운전의 위험성을 다시 깨닫게 됐습니다.", "음주운전 예방"),
    ("좋은 강의 잘 들었습니다. 늘 명심하겠습니다.", "디지털 성범죄 예방"),
    ("좋은 강의였습니다. 앞으로는 열심히 살겠습니다.", "준법의식 강화"),
    ("성범죄에 관한 깊이를 되새겼습니다. 감사합니다.", "성범죄 예방"),
    (
        "아무생각없이 성적호기심에 갖고 있을수 있는 사진한장 이라도 법적으로 크게 잘못될수 있음을 항상 깊이 맘속으로 생각하면서 살겠습니다.",
        "디지털 성범죄 예방",
    ),
    (
        "중간 법적용어에 있어서는 익숙하지 않았지만 많이 배웠습니다. 이런 교육을 받고 아는 것이 많아질수록 유익합니다.",
        "성범죄 예방",
    ),
    ("음주운전예방에 많은 도움이 되었고, 다시금 절대 하지 말아야 하는 죄라는걸 알게됐습니다.", "음주운전 예방"),
    ("디지털 성범죄를 평소에 크게 생각해본적 없었는데 이번 계기로 인해 많은걸 깨달았습니다.", "디지털 성범죄 예방"),
]


# ---------- seed runners -----------------------------------------------------


def seed_courses() -> int:
    inserted = 0
    with SessionLocal() as db:
        for title, category, price in COURSES:
            if db.scalar(select(Course).where(Course.title == title)) is not None:
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
    """Insert missing packages, and reconcile document_types if PACKAGES list changed."""
    inserted = 0
    with SessionLocal() as db:
        for name, tier, description, doc_types in PACKAGES:
            existing = db.scalar(select(Package).where(Package.tier == tier))
            if existing is None:
                pkg = Package(name=name, tier=tier, price=None, description=description)
                pkg.documents = [PackageDocument(document_type=dt) for dt in doc_types]
                db.add(pkg)
                inserted += 1
                continue
            # 기존 패키지 — document_type set 이 PACKAGES 와 다르면 동기화.
            current = {d.document_type for d in existing.documents}
            desired = set(doc_types)
            if current != desired:
                for d in list(existing.documents):
                    if d.document_type not in desired:
                        db.delete(d)
                for dt in desired - current:
                    db.add(PackageDocument(package_id=existing.id, document_type=dt))
                # 설명 문구도 함께 갱신.
                existing.description = description
        db.commit()
    return inserted


def seed_notices() -> int:
    inserted = 0
    with SessionLocal() as db:
        for n in NOTICES:
            if db.scalar(select(Notice).where(Notice.title == n["title"])) is not None:
                continue
            db.add(
                Notice(
                    title=n["title"],
                    category=n["category"],
                    author_name=n["author_name"],
                    content=n["content"],
                    is_pinned=n["is_pinned"],
                    view_count=n["view_count"],
                    created_at=n["created_at"],
                )
            )
            inserted += 1
        db.commit()
    return inserted


def seed_qna() -> int:
    inserted = 0
    with SessionLocal() as db:
        for item in QNA:
            if db.scalar(select(Post).where(Post.title == item["title"])) is not None:
                continue
            db.add(
                Post(
                    title=item["title"],
                    content=item["content"],
                    category=PostCategory.QNA,
                    author_name="익명",
                )
            )
            inserted += 1
        db.commit()
    return inserted


def seed_columns() -> int:
    inserted = 0
    with SessionLocal() as db:
        for item in COLUMNS:
            if db.scalar(select(Post).where(Post.title == item["title"])) is not None:
                continue
            db.add(
                Post(
                    title=item["title"],
                    content=item["content"],
                    category=PostCategory.COLUMN,
                    author_name="한국범죄예방교육센터",
                    created_at=item["created_at"],
                )
            )
            inserted += 1
        db.commit()
    return inserted


def seed_reviews() -> int:
    inserted = 0
    with SessionLocal() as db:
        for content, course_name in REVIEWS:
            if db.scalar(select(Post).where(Post.title == content[:80])) is not None:
                continue
            db.add(
                Post(
                    title=content[:80],  # 제목용 첫 줄
                    content=content,
                    category=PostCategory.REVIEW,
                    author_name="익명",
                    course_category=course_name,
                    rating=5,
                )
            )
            inserted += 1
        db.commit()
    return inserted


def main() -> None:
    print(f"강의 추가: {seed_courses()}개")
    print(f"패키지 추가: {seed_packages()}개")
    print(f"공지/자료실 추가: {seed_notices()}개")
    print(f"Q&A 추가: {seed_qna()}개")
    print(f"전문가 칼럼 추가: {seed_columns()}개")
    print(f"수강 후기 추가: {seed_reviews()}개")


if __name__ == "__main__":
    main()
