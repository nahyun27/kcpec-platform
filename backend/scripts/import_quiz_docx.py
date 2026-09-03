"""KCPEC_수료평가_퀴즈집_전25강.docx 를 파싱해 강의별 Quiz 로 등록.

docx 형식(고정):
  제N강  {제목}  (총 M차시)
  총 M차시 · 수료 퀴즈 10문항 · 7문항 이상 정답 시 수료
  문제 1. {질문}
  ① {보기1}
  ② {보기2}
  ③ {보기3}
  ④ {보기4}
  ... (10문항)
  정답표 / 문항 / 1..10 / 정답 / ①②③④...
  문항별 해설 (선택, 있으면 스킵 — DB 스키마에 해설 필드 없음)

docx의 "제N강" 제목 표기가 실제 DB courses.title 과 정확히 일치하지
않는 경우가 있어(스타일이 다르거나 별도 원본 문서), 강번호 → 현재
DB 제목을 LECTURE_TO_COURSE_TITLE 에 명시적으로 매핑한다. 자동
유사매칭은 하지 않음 — 강 하나라도 잘못 매핑되면 엉뚱한 강의에
퀴즈가 들어가므로, 새 강의 추가/제목 변경 시 이 표를 사람이 직접
갱신해야 한다.

기존 admin.py 의 set_quiz 와 동일한 치환(delete-then-insert) 방식.

실행: `cd backend && venv/bin/python scripts/import_quiz_docx.py [docx경로]`
      (경로 생략 시 ~/Downloads/KCPEC_수료평가_퀴즈집_전25강.docx)
      --dry-run 옵션 주면 DB 반영 없이 파싱 결과/매핑만 검증.
"""
from __future__ import annotations

import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.models.course import Course  # noqa: E402
from app.models.quiz import Quiz, QuizOption, QuizQuestion  # noqa: E402

DEFAULT_DOCX = Path.home() / "Downloads" / "KCPEC_수료평가_퀴즈집_전25강.docx"

# docx "제N강" → 현재 DB courses.title (2026-09-03 기준, 25개 시리즈 전량 등록 완료 후).
# 강의 제목이 바뀌면 이 표도 같이 갱신할 것.
LECTURE_TO_COURSE_TITLE: dict[int, str] = {
    1: "준법의식 강화",
    2: "음주운전 예방",
    3: "마약 예방",
    4: "학교폭력 예방",
    5: "성범죄 예방",
    6: "성매매 예방",
    7: "디지털 성범죄 예방",
    8: "도박 및 도박개장 예방",
    9: "피싱범죄 예방",
    10: "사기횡령배임 등 재산범죄 예방",
    11: "스토킹범죄 예방",
    12: "폭력범죄 예방교육",
    # 13강 docx 제목은 "청소년 범죄 재범방지 교육" — DB는 드라이브 폴더명 기준
    # "청소년범죄예방교육" 으로 통일하기로 함(2026-09-03 결정). 내용은 동일 강의로 간주.
    13: "청소년범죄예방교육",
    14: "운전습관·도로교통법 교육",
    15: "생활예절교육",
    16: "분노 조절·감정 통제 교육",
    17: "알코올·중독 습관 교정 교육",
    18: "경제 관념·사행성 방지 교육",
    19: "공무원 윤리 교육",
    20: "비즈니스·직장 내 윤리 교육",
    21: "단체·학교 내 윤리 교육",
    22: "디지털 저작권·정보통신 윤리 교육",
    23: "개인정보 보호·사이버 금융 범죄 예방",
    24: "보호자 양육 윤리·예방 교육",
    25: "명예훼손·모욕 예방 교육",
}

CIRCLED = {"①": 0, "②": 1, "③": 2, "④": 3}
NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def _paragraphs(docx_path: Path) -> list[str]:
    with zipfile.ZipFile(docx_path) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    lines = []
    for p in root.iter(NS + "p"):
        text = "".join(t.text or "" for t in p.iter(NS + "t"))
        if text.strip():
            lines.append(text.strip())
    return lines


def parse_docx(docx_path: Path) -> list[dict]:
    lines = _paragraphs(docx_path)

    # 목차에도 "제1강"이 한 번 나오므로, 두 번째 등장(본문 시작)부터 파싱.
    body_start = None
    seen_once = False
    for i, l in enumerate(lines):
        if l.startswith("제1강"):
            if seen_once:
                body_start = i
                break
            seen_once = True
    if body_start is None:
        raise ValueError("본문 시작 위치(제1강 두 번째 등장)를 찾지 못했습니다.")

    lectures = []
    i = body_start
    n = len(lines)
    while i < n:
        m = re.match(r"제(\d+)강\s+(.+)", lines[i])
        if not m:
            i += 1
            continue
        lec_no = int(m.group(1))
        title = m.group(2).strip()
        i += 1
        i += 1  # subheader ("총 M차시 · ...") — 사용 안 함

        questions = []
        while i < n and lines[i].startswith("문제"):
            qm = re.match(r"문제\s*\d+\.\s*(.+)", lines[i])
            qtext = qm.group(1).strip()
            i += 1
            opts = []
            while i < n and lines[i][0] in CIRCLED:
                opts.append(lines[i][1:].strip())
                i += 1
            if len(opts) != 4:
                raise ValueError(f"제{lec_no}강 문항 보기 개수 이상: {qtext!r} ({len(opts)}개)")
            questions.append({"question": qtext, "options": opts})
        if len(questions) != 10:
            raise ValueError(f"제{lec_no}강 문항 수 이상: {len(questions)}개")

        if lines[i] != "정답표":
            raise ValueError(f"제{lec_no}강: '정답표' 예상 위치에 {lines[i]!r}")
        i += 1
        if lines[i] != "문항":
            raise ValueError(f"제{lec_no}강: '문항' 헤더 없음")
        i += 1
        for k in range(10):
            if lines[i] != str(k + 1):
                raise ValueError(f"제{lec_no}강: 문항 번호 {k+1} 불일치 ({lines[i]!r})")
            i += 1
        if lines[i] != "정답":
            raise ValueError(f"제{lec_no}강: '정답' 헤더 없음")
        i += 1
        for k in range(10):
            if lines[i] not in CIRCLED:
                raise ValueError(f"제{lec_no}강: 정답 기호 아님 ({lines[i]!r})")
            questions[k]["correct_index"] = CIRCLED[lines[i]]
            i += 1

        # 문항별 해설 — 있으면 스킵 (10줄)
        if i < n and lines[i] == "문항별 해설":
            i += 1
            for _ in range(10):
                i += 1

        lectures.append({"no": lec_no, "docx_title": title, "questions": questions})

    return lectures


def main() -> None:
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    args = [a for a in args if a != "--dry-run"]
    docx_path = Path(args[0]) if args else DEFAULT_DOCX

    if not docx_path.exists():
        print(f"❌ 파일을 찾을 수 없습니다: {docx_path}")
        sys.exit(1)

    lectures = parse_docx(docx_path)
    print(f"✓ {len(lectures)}개 강 파싱 완료 (각 10문항 × 4지선다)")

    missing_mapping = [l["no"] for l in lectures if l["no"] not in LECTURE_TO_COURSE_TITLE]
    if missing_mapping:
        print(f"❌ 매핑표에 없는 강번호: {missing_mapping}")
        sys.exit(1)

    with SessionLocal() as db:
        not_found = []
        resolved: list[tuple[dict, Course]] = []
        for lec in lectures:
            title = LECTURE_TO_COURSE_TITLE[lec["no"]]
            course = db.scalar(select(Course).where(Course.title == title))
            if course is None:
                not_found.append((lec["no"], title))
            else:
                resolved.append((lec, course))

        if not_found:
            print("❌ DB에서 찾을 수 없는 강의 제목:")
            for no, title in not_found:
                print(f"   제{no}강 → {title!r}")
            sys.exit(1)

        print("✓ 25개 강 전부 Course 매칭 완료:")
        for lec, course in resolved:
            mark = " (제목 다름, 의도적 매핑)" if lec["docx_title"] != course.title else ""
            print(f"   제{lec['no']:>2}강 {lec['docx_title']!r} → course#{course.id} {course.title!r}{mark}")

        if dry_run:
            print("\n--dry-run 이므로 DB에는 반영하지 않았습니다.")
            return

        for lec, course in resolved:
            existing = db.scalar(select(Quiz).where(Quiz.course_id == course.id))
            if existing is not None:
                db.delete(existing)
                db.flush()
            quiz = Quiz(course_id=course.id)
            for idx, q in enumerate(lec["questions"]):
                question = QuizQuestion(question_text=q["question"], order_index=idx)
                question.options = [
                    QuizOption(option_text=opt, is_correct=(j == q["correct_index"]))
                    for j, opt in enumerate(q["options"])
                ]
                quiz.questions.append(question)
            db.add(quiz)
        db.commit()
        print(f"\n✅ {len(resolved)}개 강의에 퀴즈 등록 완료 (기존 퀴즈는 교체됨).")


if __name__ == "__main__":
    main()
