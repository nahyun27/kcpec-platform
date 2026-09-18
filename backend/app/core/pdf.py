"""수료증 PDF 생성기 — PPTX 템플릿 + LibreOffice headless.

흐름:
1. course.title 로 CERT_TEMPLATE_MAP 조회 → PPTX 파일 경로 + 과정코드 + 강의명
2. PPTX 사본을 임시 디렉터리에 만들고 python-pptx 로 셀 텍스트 치환
   - Shape 90 : 증서번호 텍스트박스
   - Shape 88 : 발급일자 텍스트박스
   - Shape 92 : 메인 표 (이수과정/이수일자/성명/생년월일 셀)
3. soffice --headless --convert-to pdf 로 PDF 변환
4. backend/static/pdfs/cert_{file_token}.pdf 로 복사 (file_token: 추측 불가능한
   랜덤 값 — /static 이 인증 없이 공개 서빙되므로 doc_id 를 그대로 쓰면 안 됨)
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
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Pt

from app.core.cert_config import get_cert_template, get_pledge_file

BACKEND_DIR = Path(__file__).resolve().parents[2]
STATIC_DIR = BACKEND_DIR / "static"
TEMPLATES_DIR = STATIC_DIR / "templates" / "certificates"
PLEDGE_TEMPLATES_DIR = STATIC_DIR / "templates" / "pledges"
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


def cert_course_code(course_title: str) -> str:
    """course_title 로 과정코드 조회. 등록 안 된 강의(예: 심리상담류)는 "00"."""
    cfg = get_cert_template(course_title)
    return cfg["code"] if cfg else "00"


def build_issue_number(course_title: str, sequence: int, issued: date) -> str:
    """{year}-kcpec-{과정코드}-{순번 5자리} 형식의 증서번호.

    sequence 는 doc.id(전체 발급 문서 기준 전역 순번)가 아니라, 과정코드별로
    구 사이트 발급 이력을 이어받아 세는 순번이다(2026-09) —
    app.core.cert_sequence.reserve_next_sequence 로 발급 전 미리 채번한다.
    """
    code = cert_course_code(course_title)
    return f"{issued.year}-kcpec-{code}-{sequence:05d}"


def _format_korean_date(d: date) -> str:
    return f"{d.year}년 {d.month}월 {d.day}일"


def _spaced_name(name: str) -> str:
    """'홍길동' → '홍 길 동'."""
    return " ".join(list(name.strip()))


# 이수과정 셀(1.71in 폭, 12pt)에 한 줄로 안 들어가는 긴 과정명 — LibreOffice의
# 자동 줄바꿈은 한글을 글자 수 기준으로만 끊어서 "…사이버금" / "융범죄…"처럼
# 단어 중간이 잘리므로, 자연스러운 단어 경계에서 직접 두 줄로 나눠 채운다
# (2026-09, 실제 발급 대상 6개 과정에서 확인 — 그 외 과정명은 한 줄에 들어감).
COURSE_TITLE_LINE_BREAKS: dict[str, tuple[str, str]] = {
    "운전습관도로교통법교육": ("운전습관", "도로교통법교육"),
    "분노조절감정통제교육": ("분노조절", "감정통제교육"),
    "경제관념사행성방지교육": ("경제관념", "사행성방지교육"),
    "비즈니스직장윤리교육": ("비즈니스", "직장윤리교육"),
    "디지털저작권정보통신윤리교육": ("디지털저작권", "정보통신윤리교육"),
    "개인정보보호사이버금융범죄예방교육": ("개인정보보호사이버", "금융범죄예방교육"),
}


def _fill_two_line_cell(text_frame, line1: str, line2: str) -> None:
    """이미 2개 문단으로 나뉜 셀에 지정된 두 줄을 각각 채운다.

    문단을 하나로 합치고 남는 문단을 지우는 대신, 기존 두 문단을 그대로
    재사용한다 — 템플릿 제작자가 이 셀들만 애초에 2문단으로 만들어 둔
    이유이기도 하다.
    """
    paragraphs = text_frame.paragraphs
    for para, text in zip(paragraphs[:2], (line1, line2)):
        if para.runs:
            para.runs[0].text = text
            for r in para.runs[1:]:
                r.text = ""
        else:
            para.add_run().text = text
    for para in paragraphs[2:]:
        para._p.getparent().remove(para._p)


def _replace_text_frame(
    text_frame,
    new_text: str,
    *,
    align: PP_ALIGN | None = None,
    font_size: Pt | None = None,
) -> None:
    """텍스트 프레임의 텍스트를 새 문자열로 교체.
    첫 paragraph 의 첫 run 포맷(폰트/크기/색상)을 보존한다.

    align/font_size 를 주면 원본 템플릿 서식을 덮어쓴다 — 이수일자/생년월일/
    성명 셀은 템플릿 제작자가 고정된 예시 값(예: "최 명 환", "1997년  5월
    29일") 길이에 맞춰 왼쪽 정렬 + 수동으로 앞에 공백을 채워 넣는 방식으로
    "센터에 가깝게" 보이게 만들어둔 것이었다. 실제 이름/날짜는 길이가
    제각각이라(이름 2~4자, 일자가 한 자리/두 자리 등) 이 수동 패딩 방식으로는
    항상 어긋나고, 두 자리 월/일이 들어오면 셀 너비를 넘겨 줄바꿈까지
    일어났다(2026-09, 실제 발급 건에서 발견). 정렬은 명시적으로 가운데로
    고정하고, 두 자리 일자에도 한 줄에 들어가도록 셀 폰트 크기를 살짝
    줄인다.
    """
    paragraphs = text_frame.paragraphs
    if not paragraphs:
        return
    first_para = paragraphs[0]
    if align is not None:
        first_para.alignment = align
    if first_para.runs:
        first_para.runs[0].text = new_text
        if font_size is not None:
            first_para.runs[0].font.size = font_size
        for r in first_para.runs[1:]:
            r.text = ""
    else:
        run = first_para.add_run()
        run.text = new_text
        if font_size is not None:
            run.font.size = font_size
    # 추가 paragraph 는 통째로 제거한다 — 텍스트만 비우면 빈 문단이 그대로
    # 한 줄 분량의 세로 공간을 차지해서, 세로 가운데 정렬(anchor=ctr)된
    # 셀에서 실제 텍스트가 위쪽으로 쏠려 보이는 원인이 된다(2026-09, 일부
    # 이수과정명은 템플릿 제작 시점에 이미 2개 문단으로 미리 나뉘어 있었는데
    # — 예: "개인정보보호·" / "사이버금융범죄 예방교육" — 우리는 그 중
    # 첫 문단에만 전체 제목을 채워 넣고 둘째 문단은 비우기만 해서 발견됨).
    for para in paragraphs[1:]:
        para._p.getparent().remove(para._p)


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
            if course_title in COURSE_TITLE_LINE_BREAKS:
                _fill_two_line_cell(
                    table.cell(0, 1).text_frame, *COURSE_TITLE_LINE_BREAKS[course_title]
                )
            else:
                _replace_text_frame(table.cell(0, 1).text_frame, course_title)
            _replace_text_frame(
                table.cell(0, 3).text_frame,
                issued_str,
                align=PP_ALIGN.CENTER,
                font_size=Pt(10.5),
            )
            # row 1(성명/생년월일)의 회색 음영은 셀 자체 fill 이 아니라 테이블
            # 스타일의 band1H(테마 dk1 색 20% 투명도)에서 나온다 — 화면/PNG
            # 렌더링은 정상인데 LibreOffice의 PPTX→PDF 변환에서만 이 alpha가
            # 무시되고 완전 불투명 검정으로 나와 성명/생년월일 행 전체가 검은
            # 막대로 뒤덮이는 버그가 있었다(2026-09 발견). alpha 20% 검정을
            # 흰 배경에 합성한 값(RGB 204,204,204)으로 셀 fill 을 명시 고정해
            # 이 투명도 버그를 우회한다.
            for col in range(4):
                cell = table.cell(1, col)
                cell.fill.solid()
                cell.fill.fore_color.rgb = RGBColor(0xCC, 0xCC, 0xCC)
            _replace_text_frame(table.cell(1, 1).text_frame, name_str, align=PP_ALIGN.CENTER)
            _replace_text_frame(
                table.cell(1, 3).text_frame,
                birth_str,
                align=PP_ALIGN.CENTER,
                font_size=Pt(10.5),
            )

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
    course_title: str,
    sequence: int,
    file_token: str,
    recipient_name: str,
    birth_date: date,
    issued_date: date,
) -> tuple[Path, str]:
    """수료증 PDF 를 생성하고 (저장 경로, 증서번호) 를 반환.

    course_title: DB course.title 원문 — 템플릿 조회 키(course_id 는 로컬/운영
    DB마다 다른 강의를 가리킬 수 있어 쓰면 안 됨. cert_config.py 참고).
    sequence: 과정코드별 발급 순번(cert_sequence.reserve_next_sequence 로
    미리 채번) — 증서번호의 마지막 5자리에 그대로 들어간다.
    file_token: 저장 파일명에 쓰는 랜덤 토큰. /static 이 인증 없이 공개
    서빙되므로 순차적인 값을 파일명에 쓰면 정수를 늘려가며 전체 발급 문서를
    스캔당할 수 있어, 반드시 추측 불가능한 값을 넘겨야 함.
    """
    cfg = get_cert_template(course_title)
    if cfg is None:
        raise ValueError(f"등록된 수료증 템플릿이 없습니다: course_title={course_title!r}")

    src = TEMPLATES_DIR / cfg["file"]
    if not src.exists():
        raise RuntimeError(f"템플릿 파일 누락: {src}")

    cert_number = build_issue_number(course_title, sequence, issued_date)

    PDF_DIR.mkdir(parents=True, exist_ok=True)
    final_path = PDF_DIR / f"cert_{file_token}.pdf"

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


# ---------- 서약서 PDF (수료증과 세트로 함께 발급) --------------------------


def _fill_pledge_template(
    pptx_path: Path,
    *,
    cert_number: str,
    recipient_name: str,
    issued_date: date,
) -> None:
    """서약서 PPTX 사본을 in-place 로 수정한다.

    수료증(pdf.py 상단)과 동일한 shape id 구조를 그대로 쓴다(같은 제작
    파이프라인으로 만들어진 템플릿이라 확인됨):
      - shape 90 : 증서번호
      - shape 88 : 서약일자
      - shape 92 : 본문 표 — cell(0,0) 첫 문단의 두 번째 run 이 "본인 ___는(은)"
        의 빈칸(성명)
      - shape 93 : "서약자 :        (인)" 서명란
    """
    prs = Presentation(str(pptx_path))
    slide = prs.slides[0]

    issued_str = _format_korean_date(issued_date)
    name_str = _spaced_name(recipient_name)

    for shape in slide.shapes:
        sid = shape.shape_id
        if sid == 90 and shape.has_text_frame:
            _replace_text_frame(shape.text_frame, f"증 {cert_number} 호")
        elif sid == 88 and shape.has_text_frame:
            _replace_text_frame(shape.text_frame, f"서약일자 : {issued_str}")
        elif sid == 92 and shape.has_table:
            para = shape.table.cell(0, 0).text_frame.paragraphs[0]
            if len(para.runs) > 1:
                para.runs[1].text = name_str
        elif sid == 93 and shape.has_text_frame:
            _replace_text_frame(shape.text_frame, f"서약자 :  {name_str}  (인)")

    prs.save(str(pptx_path))


def generate_pledge_pdf(
    *,
    course_title: str,
    file_token: str,
    recipient_name: str,
    issued_date: date,
    cert_number: str,
) -> Path | None:
    """서약서 PDF 를 생성해 저장 경로를 반환. 등록된 서약서 템플릿이 없는
    강의(예: 심리상담)는 None 을 반환 — 호출부가 조용히 건너뛴다.

    cert_number 는 같은 세트로 발급되는 수료증과 동일한 증서번호를 그대로
    받아서 쓴다(수료증·서약서를 별개 문서번호로 관리할 이유가 없음).
    """
    pledge_file = get_pledge_file(course_title)
    if pledge_file is None:
        return None

    src = PLEDGE_TEMPLATES_DIR / pledge_file
    if not src.exists():
        raise RuntimeError(f"서약서 템플릿 파일 누락: {src}")

    PDF_DIR.mkdir(parents=True, exist_ok=True)
    final_path = PDF_DIR / f"pledge_{file_token}.pdf"

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        tmp_pptx = tmp / "pledge.pptx"
        shutil.copy(src, tmp_pptx)
        _fill_pledge_template(
            tmp_pptx,
            cert_number=cert_number,
            recipient_name=recipient_name,
            issued_date=issued_date,
        )
        tmp_pdf = _convert_to_pdf(tmp_pptx, tmp)
        shutil.copy(tmp_pdf, final_path)

    return final_path
