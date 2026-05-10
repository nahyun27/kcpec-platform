"""심리상담 의견서 DOCX 생성기.

흐름:
1. backend/static/templates/counseling_template.docx 사본 생성
2. 표 셀에 설문 응답 + draft_text 의 [상담배경] / [상담내용] 섹션 채우기
3. 발급일 셀의 날짜 paragraph 갱신
4. (호출 측에서 필요 시) convert_office_to_pdf 로 PDF 변환

cell 좌표는 실제 템플릿 inspect 결과 기반:
- T0 R0 C0 : 증번호
- T0 R3 C1 : 성명
- T0 R3 C3 : 연령 (만 N세)
- T0 R4 C1 : 생년월일 (YY년 MM월 DD일)
- T0 R4 C3 : 연락처
- T0 R5 C1 : 상담내용 (= draft 의 [상담배경] 섹션)
- T0 R6 C1 : 상담의견 (= draft 의 [상담내용] 섹션)
- T0 R7    : 발급일 (multi-paragraph; "년/월/일" paragraph 만 갱신)

폰트/크기는 첫 run 의 서식을 보존한다.
"""

from __future__ import annotations

import re
import shutil
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from docx import Document
from docx.table import _Cell

from app.models.counseling import CounselingSurvey
from app.models.user import User

BACKEND_DIR = Path(__file__).resolve().parents[2]
TEMPLATE_PATH = (
    BACKEND_DIR / "static" / "templates" / "counseling_template.docx"
)
DRAFTS_DIR = BACKEND_DIR / "static" / "drafts"


# ---------- 셀 텍스트 치환 ----------------------------------------------------


def _set_cell_text(cell: _Cell, text: str) -> None:
    """셀을 단일 paragraph + 단일 run 으로 재구성하여 text 삽입.
    첫 paragraph 첫 run 의 서식을 보존한다. 멀티라인은 \\n 을 줄바꿈으로.
    """
    paragraphs = list(cell.paragraphs)
    lines = text.split("\n") if text else [""]

    # 첫 paragraph 만 살리고 나머지 paragraph 는 제거.
    first_p = paragraphs[0] if paragraphs else cell.add_paragraph()

    # 기존 first run 의 폰트/크기/볼드를 보존하기 위해 일단 텍스트만 비움.
    template_run = first_p.runs[0] if first_p.runs else None

    # 첫 run 의 텍스트를 첫 라인으로 교체. 나머지 run 은 텍스트 비움.
    if template_run is not None:
        template_run.text = lines[0]
        for r in first_p.runs[1:]:
            r.text = ""
    else:
        first_p.add_run(lines[0])

    # 첫 paragraph 이후의 paragraph 제거.
    for p in paragraphs[1:]:
        p._element.getparent().remove(p._element)

    # 추가 라인은 새 paragraph 로 — 첫 paragraph 의 스타일/run 폰트를 모방.
    template_font_name = (
        template_run.font.name if template_run else None
    )
    template_font_size = (
        template_run.font.size if template_run else None
    )
    for line in lines[1:]:
        p = cell.add_paragraph()
        run = p.add_run(line)
        if template_font_name:
            run.font.name = template_font_name
        if template_font_size:
            run.font.size = template_font_size


def _set_paragraph_text(paragraph, text: str) -> None:
    """paragraph 의 텍스트만 교체 (첫 run 서식 보존)."""
    if paragraph.runs:
        paragraph.runs[0].text = text
        for r in paragraph.runs[1:]:
            r.text = ""
    else:
        paragraph.add_run(text)


# ---------- 인적사항 파싱 -----------------------------------------------------


_AGE_RE = re.compile(r"(\d{1,3})\s*세")
_PHONE_RE = re.compile(r"(\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4})")
_BIRTH_RE = re.compile(
    r"(\d{2,4})\s*[년./-]\s*(\d{1,2})\s*[월./-]\s*(\d{1,2})\s*일?"
)


@dataclass
class PersonalInfo:
    name: str
    age: str       # "만 N세" 또는 ""
    birth: str     # "YY년 MM월 DD일" 또는 ""
    phone: str     # "010-1234-5678" 형태 또는 ""


def _format_birth(d: date) -> str:
    return f"{d.year % 100:02d}년 {d.month:02d}월 {d.day:02d}일"


def _calc_age(birth: date, today: date) -> int:
    years = today.year - birth.year
    if (today.month, today.day) < (birth.month, birth.day):
        years -= 1
    return years


def parse_personal_info(
    user: User, q1_text: str, today: date | None = None
) -> PersonalInfo:
    """User 정보 우선, 부족하면 q1(인적사항) 텍스트에서 보완 파싱."""
    today = today or date.today()
    name = user.username or ""
    birth = ""
    age = ""
    phone = ""

    if user.birth_date:
        birth = _format_birth(user.birth_date)
        age = f"만 {_calc_age(user.birth_date, today)}세"
    else:
        m = _BIRTH_RE.search(q1_text)
        if m:
            yy, mm, dd = m.groups()
            birth = f"{int(yy):02d}년 {int(mm):02d}월 {int(dd):02d}일"
        am = _AGE_RE.search(q1_text)
        if am:
            age = f"만 {int(am.group(1))}세"

    pm = _PHONE_RE.search(q1_text)
    if pm:
        phone = pm.group(1).replace(" ", "-")

    return PersonalInfo(name=name, age=age, birth=birth, phone=phone)


# ---------- draft_text 섹션 분리 ---------------------------------------------


def _split_draft_sections(draft_text: str) -> tuple[str, str]:
    """draft_text 에서 [상담배경] / [상담내용] 섹션 분리.
    형식이 어긋나면 전체를 상담내용 셀에 넣는다.
    """
    if "[상담배경]" in draft_text and "[상담내용]" in draft_text:
        bg = (
            draft_text.split("[상담배경]", 1)[1]
            .split("[상담내용]", 1)[0]
            .strip()
        )
        ct = draft_text.split("[상담내용]", 1)[1].strip()
        return bg, ct
    return "", draft_text.strip()


# ---------- 메인 생성 함수 ----------------------------------------------------


def build_doc_number(survey_id: int, today: date) -> str:
    return (
        f"증 {today.year}-kcpec-{today.month:02d}-{survey_id:05d} 호"
    )


def fill_counseling_template(
    survey: CounselingSurvey,
    user: User,
    draft_text: str,
    output_path: Path,
    today: date | None = None,
) -> Path:
    """양식에 데이터 채워서 output_path 에 DOCX 저장. 저장 경로 반환."""
    if not TEMPLATE_PATH.exists():
        raise RuntimeError(f"템플릿 파일 누락: {TEMPLATE_PATH}")

    today = today or date.today()
    q1 = (survey.responses or {}).get("인적사항", "")
    info = parse_personal_info(user, q1, today)
    background, content = _split_draft_sections(draft_text)
    doc_number = build_doc_number(survey.id, today)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(TEMPLATE_PATH, output_path)

    doc = Document(str(output_path))
    table = doc.tables[0]

    _set_cell_text(table.rows[0].cells[0], doc_number)
    _set_cell_text(table.rows[3].cells[1], info.name)
    _set_cell_text(table.rows[3].cells[3], info.age)
    _set_cell_text(table.rows[4].cells[1], info.birth)
    _set_cell_text(table.rows[4].cells[3], info.phone)
    _set_cell_text(table.rows[5].cells[1], background or "(설문 응답 기반 초안 없음)")
    _set_cell_text(table.rows[6].cells[1], content or "(초안 없음)")

    # 발급일: R7 셀의 paragraph 중 "년 ... 월 ... 일" 패턴을 가진 것을 찾아 갱신
    issued_str = f"{today.year}년 {today.month:>2d}월 {today.day:>2d}일"
    issue_cell = table.rows[7].cells[0]
    for para in issue_cell.paragraphs:
        if "년" in para.text and "월" in para.text and "일" in para.text:
            _set_paragraph_text(para, issued_str)
            break

    doc.save(str(output_path))
    return output_path


__all__ = [
    "build_doc_number",
    "fill_counseling_template",
    "parse_personal_info",
]
