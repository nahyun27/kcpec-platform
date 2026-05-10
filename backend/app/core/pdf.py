"""수료증 PDF 생성기 — PPTX 템플릿 + LibreOffice headless.

흐름:
1. course_id 로 CERT_TEMPLATE_MAP 조회 → PPTX 파일 경로 + 과정코드 + 강의명
2. PPTX 사본을 임시 디렉터리에 만들고 python-pptx 로 셀 텍스트 치환
   - Shape 90 : 증서번호 텍스트박스
   - Shape 88 : 발급일자 텍스트박스
   - Shape 92 : 메인 표 (이수과정/이수일자/성명/생년월일 셀)
3. soffice --headless --convert-to pdf 로 PDF 변환
4. backend/static/pdfs/cert_{doc_id}.pdf 로 복사
5. (Path, issue_number) 반환

run.text 만 교체하므로 폰트/크기/색상 등 기존 서식은 보존된다.
교육내용(Row 2)·기관명·하단 본문 등 고정 텍스트는 건드리지 않는다.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from datetime import date
from pathlib import Path

from pptx import Presentation

from app.core.cert_config import get_cert_template

BACKEND_DIR = Path(__file__).resolve().parents[2]
STATIC_DIR = BACKEND_DIR / "static"
TEMPLATES_DIR = STATIC_DIR / "templates" / "certificates"
PDF_DIR = STATIC_DIR / "pdfs"

# LibreOffice 변환 타임아웃 (단건 PPTX 변환은 보통 5초 내 완료)
SOFFICE_TIMEOUT_SEC = 60

# soffice 실행 파일 후보 (PATH → macOS app bundle → 일반 Linux 경로)
_SOFFICE_FALLBACKS = (
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
)


def _find_soffice() -> str:
    found = shutil.which("soffice") or shutil.which("libreoffice")
    if found:
        return found
    for cand in _SOFFICE_FALLBACKS:
        if Path(cand).exists():
            return cand
    raise RuntimeError(
        "LibreOffice(soffice) 실행 파일을 찾을 수 없습니다. "
        "macOS: brew install --cask libreoffice / "
        "Ubuntu: apt-get install libreoffice",
    )


def build_issue_number(course_id: int, doc_id: int, issued: date) -> str:
    """{year}-kcpec-{과정코드}-{doc_id 5자리} 형식의 증서번호."""
    cfg = get_cert_template(course_id)
    code = cfg["code"] if cfg else "00"
    return f"{issued.year}-kcpec-{code}-{doc_id:05d}"


def _format_korean_date(d: date) -> str:
    return f"{d.year}년 {d.month}월 {d.day}일"


def _spaced_name(name: str) -> str:
    """'홍길동' → '홍 길 동'."""
    return " ".join(list(name.strip()))


def _replace_text_frame(text_frame, new_text: str) -> None:
    """텍스트 프레임의 텍스트를 새 문자열로 교체.
    첫 paragraph 의 첫 run 포맷(폰트/크기/색상)을 보존한다.
    """
    paragraphs = text_frame.paragraphs
    if not paragraphs:
        return
    first_para = paragraphs[0]
    if first_para.runs:
        first_para.runs[0].text = new_text
        for r in first_para.runs[1:]:
            r.text = ""
    else:
        first_para.add_run().text = new_text
    # 추가 paragraph 들 안의 run 도 모두 비움
    for para in paragraphs[1:]:
        for r in para.runs:
            r.text = ""


def _fill_template(
    pptx_path: Path,
    *,
    cert_number: str,
    course_title: str,
    recipient_name: str,
    birth_date: date,
    issued_date: date,
) -> None:
    """PPTX 사본을 in-place 로 수정한다."""
    prs = Presentation(str(pptx_path))
    slide = prs.slides[0]

    issued_str = _format_korean_date(issued_date)
    birth_str = _format_korean_date(birth_date)
    name_str = _spaced_name(recipient_name)

    for shape in slide.shapes:
        sid = shape.shape_id
        # 증서번호 (좌상단)
        if sid == 90 and shape.has_text_frame:
            _replace_text_frame(shape.text_frame, f"증 {cert_number} 호")
        # 발급일자 (하단 텍스트박스)
        elif sid == 88 and shape.has_text_frame:
            _replace_text_frame(shape.text_frame, f"발급일자 : {issued_str}")
        # 메인 표 — 4셀만 갱신, 교육내용(Row 2) 은 템플릿 그대로
        elif sid == 92 and shape.has_table:
            table = shape.table
            _replace_text_frame(table.cell(0, 1).text_frame, course_title)
            _replace_text_frame(table.cell(0, 3).text_frame, issued_str)
            _replace_text_frame(table.cell(1, 1).text_frame, name_str)
            _replace_text_frame(table.cell(1, 3).text_frame, birth_str)

    prs.save(str(pptx_path))


def convert_office_to_pdf(input_path: Path, out_dir: Path) -> Path:
    """soffice headless 로 Office 파일(PPTX/DOCX/...) → PDF 변환.
    성공 시 PDF 경로 반환. 실패 시 RuntimeError.
    """
    soffice = _find_soffice()
    result = subprocess.run(
        [
            soffice,
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(out_dir),
            str(input_path),
        ],
        capture_output=True,
        timeout=SOFFICE_TIMEOUT_SEC,
    )
    pdf_path = out_dir / f"{input_path.stem}.pdf"
    if not pdf_path.exists():
        raise RuntimeError(
            f"PDF 변환 실패 (returncode={result.returncode}): "
            f"{result.stderr.decode(errors='replace')}",
        )
    return pdf_path


# 기존 호출자(generate_certificate_pdf) 호환용 별칭.
_convert_to_pdf = convert_office_to_pdf


def generate_certificate_pdf(
    *,
    course_id: int,
    doc_id: int,
    recipient_name: str,
    birth_date: date,
    issued_date: date,
) -> tuple[Path, str]:
    """수료증 PDF 를 생성하고 (저장 경로, 증서번호) 를 반환."""
    cfg = get_cert_template(course_id)
    if cfg is None:
        raise ValueError(f"등록된 수료증 템플릿이 없습니다: course_id={course_id}")

    src = TEMPLATES_DIR / cfg["file"]
    if not src.exists():
        raise RuntimeError(f"템플릿 파일 누락: {src}")

    cert_number = build_issue_number(course_id, doc_id, issued_date)

    PDF_DIR.mkdir(parents=True, exist_ok=True)
    final_path = PDF_DIR / f"cert_{doc_id}.pdf"

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        # 1) 템플릿 사본 + 텍스트 치환
        tmp_pptx = tmp / "cert.pptx"
        shutil.copy(src, tmp_pptx)
        _fill_template(
            tmp_pptx,
            cert_number=cert_number,
            course_title=cfg["title"],
            recipient_name=recipient_name,
            birth_date=birth_date,
            issued_date=issued_date,
        )
        # 2) LibreOffice 로 PDF 변환
        tmp_pdf = _convert_to_pdf(tmp_pptx, tmp)
        # 3) 최종 위치로 복사
        shutil.copy(tmp_pdf, final_path)

    return final_path, cert_number
