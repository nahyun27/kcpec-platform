"""반성문·탄원서 서식 생성기.

AI(legal_letter_ai.py)가 작성한 본문과 고객이 입력한 사건정보·작성자정보를
법원 제출용 서식(docx)에 채워 넣는다.

발급 방식(2026-09, 심리상담 의견서와 동일하게 통일): 관리자가 채워진 워드
파일을 다운로드해 서명 위치·줄바꿈 등을 직접 다듬은 뒤, 최종 PDF를 관리자가
직접 업로드해야 고객에게 공개된다 — `generate_legal_letter_docx` 로 다운로드용
docx 를, `generate_legal_letter_pdf` 로 "PDF 미리보기"(고객에겐 비공개, 관리자가
서식이 안 깨졌는지 훑어보는 용도)용 PDF를 만든다. 실제 발급되는 PDF는 이
모듈이 만드는 게 아니라 관리자가 업로드한 파일 그대로다(legal_letters.py
upload-final).

템플릿 원본 마지막 페이지에는 "이 양식은 참고용이며 자필로 옮겨 적는 것을
권장한다"는 작성 유의사항이 있는데, 그 페이지는 법원에 내는 문서가 아니므로
채워진 서식에서는 제거한다(_strip_guidance_section). 같은 안내 문구는 프론트
엔드 작성 폼 화면에 그대로 보여준다(frontend LEGAL_LETTER_TIPS, 별도 하드코딩
— 내용을 바꾸면 양쪽 다 갱신해야 함).
"""

from __future__ import annotations

import shutil
import tempfile
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn

from app.core.docx_utils import set_cell_text, set_paragraph_text
from app.core.pdf import convert_office_to_pdf

BACKEND_DIR = Path(__file__).resolve().parents[2]
TEMPLATES_DIR = BACKEND_DIR / "static" / "templates" / "legal_letters"
PDF_DIR = BACKEND_DIR / "static" / "pdfs"
# 관리자가 워드로 다운받아 직접 다듬을 수 있게 내보내는 docx 저장 위치 —
# 심리상담 의견서 내보내기(admin.py EXPORTS_DIR)와 같은 물리 경로.
EXPORTS_DIR = BACKEND_DIR / "static" / "exports"

TEMPLATE_FILES: dict[str, Path] = {
    "repentance": TEMPLATES_DIR / "repentance_template.docx",
    "petition": TEMPLATES_DIR / "petition_template.docx",
}


@dataclass
class LegalLetterInput:
    case_number: str | None
    charge: str  # 죄명 — 반성문·탄원서 공통
    defendant_name: str | None  # 사건당사자(피고인) 성명 — 탄원서만 사용
    court_name: str  # 관할명(경찰/검찰/법원 등)
    writer_name: str
    writer_birth: date
    # 탄원서는 주소·연락처 생략 가능(의뢰인 확정 사항) — 반성문은 필수로 받되
    # 이 dataclass 레벨에서는 동일하게 Optional 로 두고 필수 여부는 요청
    # 스키마(legal_letters.py)에서 강제한다.
    writer_address: str | None
    writer_phone: str | None
    relationship: str | None  # 탄원서만 사용 — 사건당사자와의 관계
    content: str  # AI 가 작성한 본문


def _korean_date(d: date) -> str:
    return f"{d.year}년 {d.month}월 {d.day}일"


def _strip_guidance_section(doc: Document) -> None:
    """"...귀중" 문단 뒤에 오는 작성 유의사항 페이지(표 1개 + 여백 문단)를
    제거한다. 마지막 요소(sectPr, 페이지 여백 등 섹션 속성)는 문서 구조상
    반드시 남겨야 하므로 건드리지 않는다. 두 템플릿이 페이지나눔 표시 방식이
    조금씩 달라(반성문=명시적 페이지나눔, 탄원서=단순 빈 문단) 위치를
    하드코딩하지 않고 "귀중" 문단을 찾아 그 뒤를 전부 지우는 방식으로 통일."""
    body = doc.element.body
    children = list(body)
    court_idx = None
    for i, el in enumerate(children):
        if el.tag == qn("w:p"):
            text = "".join(t.text or "" for t in el.findall(".//" + qn("w:t")))
            if "귀중" in text:
                court_idx = i
    if court_idx is None:
        return
    for el in children[court_idx + 1 : len(children) - 1]:
        body.remove(el)


def _replace_paragraph_containing(doc: Document, marker: str, new_text: str) -> None:
    for p in doc.paragraphs:
        if marker in p.text:
            set_paragraph_text(p, new_text)
            return


def _fill_content_table(doc: Document, content: str) -> None:
    """세 번째 표("내용")가 손글씨용 빈 줄 32칸으로 되어 있다. 타이핑된 본문을
    그 32줄에 억지로 나눠 넣지 않고, 첫 칸에 문단으로 채운 뒤 나머지 빈
    줄은 지운다(내용 길이에 맞춰 자연스럽게 늘어나도록)."""
    content_table = doc.tables[2]
    first_row = content_table.rows[0]

    # 원본 행 높이가 hRule="exact" 고정값(빈 줄 1개 높이) + cantSplit 이라,
    # 여러 줄을 넣으면 셀이 자라지 못하고 넘친 내용이 그대로 잘려 보이는
    # 문제가 있었다(로컬 렌더링으로 확인) — 고정 높이를 풀어서 내용 길이에
    # 맞춰 자연스럽게 늘어나고 페이지도 넘어갈 수 있게 한다.
    tr_pr = first_row._tr.find(qn("w:trPr"))
    if tr_pr is not None:
        for tag in ("w:trHeight", "w:cantSplit"):
            el = tr_pr.find(qn(tag))
            if el is not None:
                tr_pr.remove(el)

    set_cell_text(first_row.cells[0], content)
    for row in list(content_table.rows[1:]):
        content_table._tbl.remove(row._tr)


def _fill_legal_letter_docx(
    *, template_path: Path, dest_docx: Path, letter_type: str, data: LegalLetterInput, issued_date: date
) -> None:
    """템플릿을 dest_docx 로 복사해 채워 넣는다(generate_legal_letter_pdf /
    generate_legal_letter_docx 공통 로직)."""
    shutil.copy(template_path, dest_docx)

    doc = Document(dest_docx)
    tables = doc.tables

    case_table = tables[0]
    set_cell_text(case_table.rows[0].cells[1], data.case_number or "")
    if letter_type == "petition":
        # petition_template.docx 는 사건번호/피고인 성명/죄명/관할 4행
        # (죄명 행은 2026-09 추가 — 원본엔 없었음).
        set_cell_text(case_table.rows[1].cells[1], data.defendant_name or "")
        set_cell_text(case_table.rows[2].cells[1], data.charge)
        set_cell_text(case_table.rows[3].cells[1], data.court_name)
    else:
        # repentance_template.docx 는 사건번호/죄명/관할 3행.
        set_cell_text(case_table.rows[1].cells[1], data.charge)
        set_cell_text(case_table.rows[2].cells[1], data.court_name)

    writer_table = tables[1]
    set_cell_text(writer_table.rows[0].cells[1], data.writer_name)
    set_cell_text(writer_table.rows[1].cells[1], _korean_date(data.writer_birth))
    set_cell_text(writer_table.rows[2].cells[1], data.writer_address or "")
    set_cell_text(writer_table.rows[3].cells[1], data.writer_phone or "")
    if letter_type == "petition" and len(writer_table.rows) > 4:
        set_cell_text(writer_table.rows[4].cells[1], data.relationship or "")

    _fill_content_table(doc, data.content)

    _replace_paragraph_containing(
        doc, "작성일자", f"작성일자 :  {_korean_date(issued_date)}"
    )
    _replace_paragraph_containing(
        doc,
        "(서명 또는 인)",
        f"성명 :  {data.writer_name}                          (서명 또는 인)",
    )
    _replace_paragraph_containing(doc, "귀중", f"{data.court_name}  귀중")

    _strip_guidance_section(doc)

    doc.save(dest_docx)


def _template_path(letter_type: str) -> Path:
    template_path = TEMPLATE_FILES.get(letter_type)
    if template_path is None or not template_path.exists():
        raise FileNotFoundError(f"서식 템플릿을 찾을 수 없습니다: {letter_type}")
    return template_path


def generate_legal_letter_docx(
    *, letter_type: str, file_token: str, data: LegalLetterInput, issued_date: date
) -> Path:
    """관리자가 워드에서 직접 다듬을 수 있도록 채워진 docx 파일을 반환한다
    (PDF 변환 없음) — 관리자가 이 파일을 받아 서명 위치 등을 손본 뒤, 최종
    PDF 는 별도로(upload-final) 직접 업로드한다."""
    template_path = _template_path(letter_type)
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    dest = EXPORTS_DIR / f"{file_token}.docx"
    _fill_legal_letter_docx(
        template_path=template_path,
        dest_docx=dest,
        letter_type=letter_type,
        data=data,
        issued_date=issued_date,
    )
    return dest


def generate_legal_letter_pdf(
    *, letter_type: str, file_token: str, data: LegalLetterInput, issued_date: date
) -> Path:
    """관리자 전용 "PDF 미리보기"(표 레이아웃이 안 깨졌는지 훑어보는 용도)를
    만든다 — 고객에게 공개되는 실제 발급 PDF 는 관리자가 직접 업로드한
    파일이며, 이 함수가 만드는 PDF 가 아니다."""
    template_path = _template_path(letter_type)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        work_docx = tmp_dir / f"{file_token}.docx"
        _fill_legal_letter_docx(
            template_path=template_path,
            dest_docx=work_docx,
            letter_type=letter_type,
            data=data,
            issued_date=issued_date,
        )
        pdf_path = convert_office_to_pdf(work_docx, tmp_dir)

        PDF_DIR.mkdir(parents=True, exist_ok=True)
        dest = PDF_DIR / f"letter_{file_token}.pdf"
        shutil.copy(pdf_path, dest)
        return dest
