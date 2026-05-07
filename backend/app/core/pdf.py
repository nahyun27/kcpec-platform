"""수료증 PDF 생성기 (reportlab).

- 한글 출력을 위해 NanumGothic.ttf 를 사용한다. 폰트가 없으면 명확히 실패해서
  운영자가 `scripts/download_fonts.sh` 를 실행하도록 유도한다.
- 결과물은 backend/static/pdfs/ 에 저장하고, FastAPI StaticFiles 가 /static/ 으로 서빙한다.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

BACKEND_DIR = Path(__file__).resolve().parents[2]
STATIC_DIR = BACKEND_DIR / "static"
PDF_DIR = STATIC_DIR / "pdfs"
FONT_PATH = STATIC_DIR / "fonts" / "NanumGothic.ttf"
FONT_NAME = "NanumGothic"

_font_registered = False


def _ensure_font() -> None:
    global _font_registered
    if _font_registered:
        return
    if not FONT_PATH.exists():
        raise RuntimeError(
            f"한글 폰트가 없습니다: {FONT_PATH} — "
            "`bash backend/scripts/download_fonts.sh` 로 먼저 받아 주세요."
        )
    pdfmetrics.registerFont(TTFont(FONT_NAME, str(FONT_PATH)))
    _font_registered = True


def render_certificate(
    *,
    issue_number: str,
    recipient_name: str,
    recipient_birth: date,
    course_title: str,
    completed_at: date,
) -> Path:
    """수료증 한 장짜리 PDF 를 그리고 저장 경로를 돌려준다."""
    _ensure_font()
    PDF_DIR.mkdir(parents=True, exist_ok=True)

    out_path = PDF_DIR / f"{issue_number}.pdf"
    c = canvas.Canvas(str(out_path), pagesize=A4)
    width, height = A4

    # 외곽 테두리
    c.setStrokeColorRGB(0.11, 0.20, 0.38)  # 네이비 #1C3461
    c.setLineWidth(2)
    c.rect(15 * mm, 15 * mm, width - 30 * mm, height - 30 * mm)
    c.setLineWidth(0.5)
    c.rect(20 * mm, 20 * mm, width - 40 * mm, height - 40 * mm)

    # 헤더
    c.setFont(FONT_NAME, 14)
    c.setFillColorRGB(0.78, 0.59, 0.23)  # 골드 #C8973A
    c.drawCentredString(width / 2, height - 50 * mm, "한국범죄예방교육센터")

    c.setFont(FONT_NAME, 36)
    c.setFillColorRGB(0.11, 0.20, 0.38)
    c.drawCentredString(width / 2, height - 80 * mm, "이 수 증")

    # 발급번호
    c.setFont(FONT_NAME, 10)
    c.setFillColorRGB(0.4, 0.4, 0.4)
    c.drawCentredString(width / 2, height - 95 * mm, f"발급번호 {issue_number}")

    # 본문
    c.setFont(FONT_NAME, 13)
    c.setFillColorRGB(0.1, 0.1, 0.1)
    body_y = height - 130 * mm
    line_h = 11 * mm

    fields = [
        ("성    명", recipient_name),
        ("생년월일", recipient_birth.isoformat()),
        ("교육과정", course_title),
        ("수 료 일", completed_at.isoformat()),
    ]
    for i, (label, value) in enumerate(fields):
        y = body_y - i * line_h
        c.drawString(50 * mm, y, f"{label}    :   {value}")

    # 마무리 문구
    c.setFont(FONT_NAME, 12)
    closing_y = body_y - len(fields) * line_h - 20 * mm
    c.drawCentredString(
        width / 2,
        closing_y,
        "위 사람은 본 센터의 심리·준법교육 과정을 성실히 이수하였기에 이 증서를 수여합니다.",
    )

    # 발급일자 + 발행처
    c.setFont(FONT_NAME, 12)
    issue_date_str = completed_at.strftime("%Y년 %m월 %d일")
    c.drawCentredString(width / 2, 60 * mm, issue_date_str)
    c.setFont(FONT_NAME, 14)
    c.drawCentredString(width / 2, 45 * mm, "한 국 범 죄 예 방 교 육 센 터")

    c.showPage()
    c.save()
    return out_path
