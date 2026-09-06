"""25개 강의 시리즈(총 135개 mp4)를 실제 Lecture row 로 등록.

영상은 이미 S3(kcpec-lecture-videos 버킷, key: lectures/{slug}/{NN}.mp4)에
업로드되어 있다는 전제. 이 스크립트는 (1) 로컬 mp4 를 ffprobe 로 읽어
길이(duration_seconds)를 구하고 (2) 각 강의(Course)에 붙어있던 기존
Lecture row 를 전부 지우고 실제 차시로 새로 생성한다.

Quiz 는 Course 단위(quiz.course_id)라 Lecture 를 지워도 영향 없음.
LectureProgress 는 lecture_id FK ondelete=CASCADE 라 기존 진도 기록은
같이 삭제됨 — 이 스크립트를 돌리는 시점(RDS: enrollment 0건, 로컬: 데모
시드 데이터뿐)에서는 안전하지만, 실사용자 진도가 쌓인 뒤 재실행하면
그 진도가 날아가니 주의.

실행: `cd backend && venv/bin/python scripts/import_lecture_videos.py`
      (RDS 대상이면 DATABASE_URL 환경변수를 RDS 접속 문자열로 오버라이드)
      --dry-run: DB 반영 없이 매핑/차시 개수만 출력
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.models.course import Course  # noqa: E402
from app.models.lecture import Lecture  # noqa: E402

VIDEO_ROOT = Path.home() / "kcpec_videos_mp4" / "업그레이드 강의 영상 모음"
FOLDER_NUM_RE = re.compile(r"^(\d+)\.")
CHASI_NUM_RE = re.compile(r"(\d+)")

# (slug, course title) — slug 는 프론트 sentencing 페이지의 CourseId 와
# 동일 + S3 key(lectures/{slug}/{NN}.mp4) 접두어. 순서는 폴더 번호(1~25)와 일치.
COURSE_MAP: list[tuple[str, str]] = [
    ("law", "준법의식 강화"),
    ("drunk", "음주운전 예방"),
    ("drug", "마약 예방"),
    ("school", "학교폭력 예방"),
    ("sex", "성범죄 예방"),
    ("prostitution", "성매매 예방"),
    ("digital_sex", "디지털 성범죄 예방"),
    ("gambling", "도박 및 도박개장 예방"),
    ("phishing", "피싱범죄 예방"),
    ("property", "사기횡령배임 등 재산범죄 예방"),
    ("stalking", "스토킹범죄 예방"),
    ("violence", "폭력범죄 예방교육"),
    ("youth", "청소년범죄예방교육"),
    ("driving_habit", "운전습관·도로교통법 교육"),
    ("life_manners", "생활예절교육"),
    ("anger", "분노 조절·감정 통제 교육"),
    ("alcohol", "알코올·중독 습관 교정 교육"),
    ("economy", "경제 관념·사행성 방지 교육"),
    ("public_official", "공무원 윤리 교육"),
    ("business_ethics", "비즈니스·직장 내 윤리 교육"),
    ("org_school_ethics", "단체·학교 내 윤리 교육"),
    ("digital_ethics", "디지털 저작권·정보통신 윤리 교육"),
    ("privacy", "개인정보 보호·사이버 금융 범죄 예방"),
    ("parenting", "보호자 양육 윤리·예방 교육"),
    ("defamation", "명예훼손·모욕 예방 교육"),
]


def ffprobe_duration(path: Path) -> int:
    out = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "json", str(path),
        ],
        capture_output=True, text=True, check=True,
    )
    return round(float(json.loads(out.stdout)["format"]["duration"]))


def main() -> None:
    dry_run = "--dry-run" in sys.argv

    by_num: dict[int, Path] = {}
    for d in VIDEO_ROOT.iterdir():
        if not d.is_dir():
            continue
        m = FOLDER_NUM_RE.match(d.name)
        if m:
            by_num[int(m.group(1))] = d

    db = SessionLocal()
    try:
        for idx, (slug, title) in enumerate(COURSE_MAP, start=1):
            src_dir = by_num.get(idx)
            if src_dir is None:
                raise SystemExit(f"MISSING SOURCE FOLDER for #{idx}: {title}")
            files = sorted(
                src_dir.glob("*.mp4"),
                key=lambda p: int(CHASI_NUM_RE.search(p.name).group(1)),
            )

            course = db.scalar(select(Course).where(Course.title == title))
            if course is None:
                raise SystemExit(f"COURSE NOT FOUND IN DB: {title!r}")

            print(f"[{idx:2d}] {title} ({slug}) — {len(files)}개 차시, course_id={course.id}")
            if dry_run:
                continue

            existing = list(db.scalars(select(Lecture).where(Lecture.course_id == course.id)))
            for lec in existing:
                db.delete(lec)
            db.flush()

            for i, f in enumerate(files, start=1):
                duration = ffprobe_duration(f)
                db.add(
                    Lecture(
                        course_id=course.id,
                        title=f"{i}차시",
                        order_index=i,
                        video_url=f"lectures/{slug}/{i:02d}.mp4",
                        duration_seconds=duration,
                        is_active=True,
                    )
                )
            db.commit()

        if dry_run:
            print("\n(dry-run — DB 변경 없음)")
        else:
            print("\n완료.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
