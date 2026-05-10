"""심리상담 의견서 DOCX 생성기.

새 템플릿(9 rows × 6 cols) 기준 셀 매핑:
  R0 C0 : 증번호 (cols 0-2 merged)
  R3 C1 : 성명
  R3 C3 : 성별
  R3 C5 : 생년월일
  R4 C1 : 상담일자 (cols 1-3 merged)
  R4 C5 : 연락처
  R5 C1 : 상담배경 및 상담취지 (cols 1-5 merged)
  R6 C1 : 상담내용 및 종합소견 (cols 1-5 merged)
  R8 C0 : 발급일 (cell 의 "년/월/일" paragraph 만 갱신)

설문 응답(survey.responses)은 두 가지 형태를 모두 받아들인다:
  - 신형: { "personal": {name, gender, birthdate, phone, ...}, "q2"..."q6": "..." }
  - 구형: { "인적사항": "텍스트", "사건내용": "...", ... }  (regex 폴백)
"""

from __future__ import annotations

import re
import shutil
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

from docx import Document
from docx.table import _Cell

from app.models.counseling import CounselingSurvey
from app.models.user import User

BACKEND_DIR = Path(__file__).resolve().parents[2]
TEMPLATE_PATH = (
    BACKEND_DIR / "static" / "templates" / "counseling_template.docx"
)


# ---------- 셀 텍스트 치환 ----------------------------------------------------


def _set_cell_text(cell: _Cell, text: str) -> None:
    """셀 내용을 text 로 교체. 첫 paragraph 첫 run 의 폰트/크기를 보존하고
    멀티라인은 paragraph 분리.
    """
    paragraphs = list(cell.paragraphs)
    lines = (text or "").split("\n") if text else [""]

    first_p = paragraphs[0] if paragraphs else cell.add_paragraph()
    template_run = first_p.runs[0] if first_p.runs else None
    template_font_name = template_run.font.name if template_run else None
    template_font_size = template_run.font.size if template_run else None

    # 첫 run 의 텍스트만 첫 라인으로 갈아치우고 나머지 run 텍스트는 비움.
    if template_run is not None:
        template_run.text = lines[0]
        for r in first_p.runs[1:]:
            r.text = ""
    else:
        first_p.add_run(lines[0])

    # 첫 paragraph 외 paragraph 제거.
    for p in paragraphs[1:]:
        p._element.getparent().remove(p._element)

    # 추가 라인은 새 paragraph 로 (스타일/폰트 모방).
    for line in lines[1:]:
        p = cell.add_paragraph()
        run = p.add_run(line)
        if template_font_name:
            run.font.name = template_font_name
        if template_font_size:
            run.font.size = template_font_size


def _set_paragraph_text(paragraph, text: str) -> None:
    if paragraph.runs:
        paragraph.runs[0].text = text
        for r in paragraph.runs[1:]:
            r.text = ""
    else:
        paragraph.add_run(text)


# ---------- 인적사항 추출 -----------------------------------------------------


_AGE_RE = re.compile(r"(\d{1,3})\s*세")
_PHONE_RE = re.compile(r"(\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4})")
_BIRTH_RE = re.compile(
    r"(\d{2,4})\s*[년./-]\s*(\d{1,2})\s*[월./-]\s*(\d{1,2})\s*일?"
)


@dataclass
class PersonalSnapshot:
    name: str = ""
    gender: str = ""
    birthdate: str = ""   # 표시용: "1991년 3월 15일" 또는 입력 문자열 그대로
    phone: str = ""


def _format_korean_birth(s: str) -> str:
    """ISO 'YYYY-MM-DD' 또는 'YY년 MM월 DD일' 등 다양한 형식을
    "YYYY년 M월 D일" 한글 형식으로 정규화. 못 알아보면 원문 반환.
    """
    if not s:
        return ""
    s = s.strip()
    # ISO YYYY-MM-DD
    iso_m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if iso_m:
        y, mo, d = iso_m.groups()
        return f"{int(y)}년 {int(mo)}월 {int(d)}일"
    bm = _BIRTH_RE.match(s)
    if bm:
        y, mo, d = bm.groups()
        if len(y) == 2:
            y = f"19{y}" if int(y) > 30 else f"20{y}"
        return f"{int(y)}년 {int(mo)}월 {int(d)}일"
    return s


def _parse_legacy_personal(q1_text: str, user: User) -> PersonalSnapshot:
    """구형 데이터: q1(인적사항) 자유 텍스트에서 정규식으로 보완 추출."""
    name = user.username or ""
    gender = ""
    birthdate = ""
    phone = ""
    if "남" in q1_text and "남자" not in q1_text and "여자" not in q1_text:
        gender = "남"
    elif "남자" in q1_text or "남성" in q1_text:
        gender = "남"
    elif "여자" in q1_text or "여성" in q1_text:
        gender = "여"
    if user.birth_date:
        birthdate = (
            f"{user.birth_date.year}년 {user.birth_date.month}월 "
            f"{user.birth_date.day}일"
        )
    else:
        bm = _BIRTH_RE.search(q1_text)
        if bm:
            y, mo, d = bm.groups()
            if len(y) == 2:
                y = f"19{y}" if int(y) > 30 else f"20{y}"
            birthdate = f"{int(y)}년 {int(mo)}월 {int(d)}일"
    pm = _PHONE_RE.search(q1_text)
    if pm:
        phone = pm.group(1).replace(" ", "-")
    return PersonalSnapshot(name=name, gender=gender, birthdate=birthdate, phone=phone)


def _personal_snapshot(survey: CounselingSurvey, user: User) -> PersonalSnapshot:
    """survey.responses 에서 personal dict 추출 — 신형 우선, 구형은 폴백."""
    responses: dict[str, Any] = survey.responses or {}
    p = responses.get("personal")
    if isinstance(p, dict):
        return PersonalSnapshot(
            name=str(p.get("name", "") or "").strip() or (user.username or ""),
            gender=str(p.get("gender", "") or "").strip(),
            birthdate=_format_korean_birth(str(p.get("birthdate", "") or "")),
            phone=str(p.get("phone", "") or "").strip(),
        )
    legacy_q1 = responses.get("인적사항") or responses.get("q1") or ""
    return _parse_legacy_personal(str(legacy_q1), user)


# ---------- draft_text 섹션 분리 ---------------------------------------------


def _split_draft_sections(draft_text: str) -> tuple[str, str]:
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
    return f"증 {today.year}-kcpec-{today.month:02d}-{survey_id:05d} 호"


def fill_counseling_template(
    survey: CounselingSurvey,
    user: User,
    draft_text: str,
    output_path: Path,
    today: date | None = None,
) -> Path:
    """양식에 데이터 채워서 output_path 에 DOCX 저장."""
    if not TEMPLATE_PATH.exists():
        raise RuntimeError(f"템플릿 파일 누락: {TEMPLATE_PATH}")

    today = today or datetime.now().date()
    info = _personal_snapshot(survey, user)
    background, content = _split_draft_sections(draft_text)
    doc_number = build_doc_number(survey.id, today)
    counseling_date = f"{today.year}년 {today.month}월 {today.day}일"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(TEMPLATE_PATH, output_path)

    doc = Document(str(output_path))
    table = doc.tables[0]

    _set_cell_text(table.rows[0].cells[0], doc_number)
    _set_cell_text(table.rows[3].cells[1], info.name)
    _set_cell_text(table.rows[3].cells[3], info.gender)
    _set_cell_text(table.rows[3].cells[5], info.birthdate)
    _set_cell_text(table.rows[4].cells[1], counseling_date)
    _set_cell_text(table.rows[4].cells[5], info.phone)
    _set_cell_text(
        table.rows[5].cells[1], background or "(설문 응답 기반 초안 없음)"
    )
    _set_cell_text(table.rows[6].cells[1], content or "(초안 없음)")

    # 발급일: R8 셀의 paragraph 들 중 "년/월/일" 패턴을 가진 것을 찾아 갱신.
    # (전체 셀을 비우면 가운데 정렬·여백 같은 템플릿 레이아웃이 깨짐)
    issued_str = f"{today.year}년   {today.month}월   {today.day}일"
    issue_cell = table.rows[8].cells[0]
    for para in issue_cell.paragraphs:
        if "년" in para.text and "월" in para.text and "일" in para.text:
            _set_paragraph_text(para, issued_str)
            break

    doc.save(str(output_path))
    return output_path


__all__ = [
    "build_doc_number",
    "fill_counseling_template",
]
