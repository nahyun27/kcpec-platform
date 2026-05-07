"""수료증 PDF 생성기 (reportlab platypus).

- PPTX 템플릿(/static/templates/certificates) 의 디자인을 reportlab 으로 재현.
- NanumGothic / NanumGothicBold 폰트 사용. Bold 가 없으면 Regular 로 폴백.
- 결과물은 backend/static/pdfs/cert_{doc_id}.pdf 에 저장하고 정적 URL 을 반환.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.flowables import HRFlowable

from app.core.cert_config import get_cert_config

BACKEND_DIR = Path(__file__).resolve().parents[2]
STATIC_DIR = BACKEND_DIR / "static"
PDF_DIR = STATIC_DIR / "pdfs"
FONT_PATH = STATIC_DIR / "fonts" / "NanumGothic.ttf"
FONT_BOLD_PATH = STATIC_DIR / "fonts" / "NanumGothicBold.ttf"

FONT_REGULAR = "NanumGothic"
FONT_BOLD = "NanumGothicBold"

_fonts_registered = False


def _ensure_fonts() -> None:
    global _fonts_registered
    if _fonts_registered:
        return
    if not FONT_PATH.exists():
        raise RuntimeError(
            f"한글 폰트가 없습니다: {FONT_PATH} — "
            "`bash backend/scripts/download_fonts.sh` 로 먼저 받아 주세요."
        )
    registered = pdfmetrics.getRegisteredFontNames()
    if FONT_REGULAR not in registered:
        pdfmetrics.registerFont(TTFont(FONT_REGULAR, str(FONT_PATH)))
    bold_path = FONT_BOLD_PATH if FONT_BOLD_PATH.exists() else FONT_PATH
    if FONT_BOLD not in registered:
        pdfmetrics.registerFont(TTFont(FONT_BOLD, str(bold_path)))
    _fonts_registered = True


def _format_date_korean(d: date) -> str:
    return f"{d.year}년 {d.month:>2}월 {d.day:>2}일"


def _spaced_name(name: str) -> str:
    """'홍길동' → '홍 길 동' (시각적 자간 효과)."""
    return " ".join(list(name.strip()))


def build_issue_number(course_id: int, doc_id: int, issued: date) -> str:
    """{year}-kcpec-{과정코드}-{doc_id 5자리} 형식의 증서번호."""
    cfg = get_cert_config(course_id)
    return f"{issued.year}-kcpec-{cfg['code']}-{doc_id:05d}"


def generate_certificate_pdf(
    *,
    course_id: int,
    doc_id: int,
    recipient_name: str,
    birth_date: date,
    issued_date: date,
) -> tuple[Path, str]:
    """수료증 PDF 를 생성하고 (저장 경로, 증서번호) 를 반환."""
    _ensure_fonts()
    cfg = get_cert_config(course_id)

    cert_number = build_issue_number(course_id, doc_id, issued_date)
    issue_date_str = _format_date_korean(issued_date)
    birth_str = _format_date_korean(birth_date)
    name_spaced = _spaced_name(recipient_name)

    PDF_DIR.mkdir(parents=True, exist_ok=True)
    out_path = PDF_DIR / f"cert_{doc_id}.pdf"

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
    )
    content_w = A4[0] - 40 * mm

    styles = {
        "cert_num": ParagraphStyle(
            "cert_num",
            fontName=FONT_REGULAR,
            fontSize=9,
            textColor=colors.black,
        ),
        "title": ParagraphStyle(
            "title",
            fontName=FONT_BOLD,
            fontSize=32,
            alignment=TA_CENTER,
            spaceAfter=8 * mm,
            textColor=colors.HexColor("#1C3461"),
        ),
        "body": ParagraphStyle(
            "body",
            fontName=FONT_REGULAR,
            fontSize=11,
            alignment=TA_CENTER,
            leading=18,
        ),
        "issue": ParagraphStyle(
            "issue",
            fontName=FONT_REGULAR,
            fontSize=11,
            alignment=TA_CENTER,
        ),
        "org": ParagraphStyle(
            "org",
            fontName=FONT_BOLD,
            fontSize=16,
            alignment=TA_CENTER,
        ),
        "cell": ParagraphStyle(
            "cell",
            fontName=FONT_REGULAR,
            fontSize=10,
            alignment=TA_CENTER,
        ),
        "cell_bold": ParagraphStyle(
            "cell_bold",
            fontName=FONT_BOLD,
            fontSize=10,
            alignment=TA_CENTER,
        ),
        "cell_left": ParagraphStyle(
            "cell_left",
            fontName=FONT_REGULAR,
            fontSize=9,
            alignment=TA_LEFT,
            leading=14,
        ),
    }

    elements: list = []

    # 증서번호 (좌상단 작은 글씨)
    elements.append(Paragraph(f"증 {cert_number} 호", styles["cert_num"]))
    elements.append(Spacer(1, 10 * mm))

    # 제목 + 가로선
    elements.append(Paragraph("수료증", styles["title"]))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.black))
    elements.append(Spacer(1, 5 * mm))

    # 메인 표 (3행)
    col_w = [content_w * 0.15, content_w * 0.35, content_w * 0.15, content_w * 0.35]
    curriculum_html = cfg["curriculum"].replace("\n", "<br/>")
    table_data = [
        [
            Paragraph("이수과정", styles["cell_bold"]),
            Paragraph(cfg["title"], styles["cell"]),
            Paragraph("이수일자", styles["cell_bold"]),
            Paragraph(issue_date_str, styles["cell"]),
        ],
        [
            Paragraph("성   명", styles["cell_bold"]),
            Paragraph(name_spaced, styles["cell"]),
            Paragraph("생년월일", styles["cell_bold"]),
            Paragraph(birth_str, styles["cell"]),
        ],
        [
            Paragraph("교육내용", styles["cell_bold"]),
            Paragraph(curriculum_html, styles["cell_left"]),
            "",
            "",
        ],
    ]

    t = Table(table_data, colWidths=col_w, rowHeights=[12 * mm, 12 * mm, None])
    t.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), FONT_REGULAR),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                # 좌측 라벨 컬럼
                ("BACKGROUND", (0, 0), (0, -1), colors.Color(0.85, 0.85, 0.85)),
                # 3번째 컬럼(이수일자/생년월일 라벨) — Row 2 는 SPAN 으로 덮임
                ("BACKGROUND", (2, 0), (2, 1), colors.Color(0.85, 0.85, 0.85)),
                ("SPAN", (1, 2), (3, 2)),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ],
        ),
    )
    elements.append(t)
    elements.append(Spacer(1, 8 * mm))

    # 본문
    elements.append(
        Paragraph(
            "위 사람은 한국범죄예방교육센터에서 실시한<br/>"
            "상기 교육과정을 성실히 이수하였으므로<br/>"
            "본 증서를 수여합니다.",
            styles["body"],
        ),
    )
    elements.append(Spacer(1, 8 * mm))

    # 발급일자
    elements.append(Paragraph(f"발급일자 : {issue_date_str}", styles["issue"]))
    elements.append(Spacer(1, 8 * mm))

    # 기관명
    elements.append(Paragraph("한국범죄예방교육센터", styles["org"]))

    doc.build(elements)
    return out_path, cert_number
