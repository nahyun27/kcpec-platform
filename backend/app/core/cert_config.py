"""course_id → 수료증 PPTX 템플릿 + 과정코드 매핑.

- `file`: backend/static/templates/certificates/ 안의 PPTX 파일명
- `code`: 증서번호 prefix 의 과정코드 ({year}-kcpec-{code}-{seq})
- `title`: PPTX 표 안 "이수과정" 셀에 채워 넣을 강의명
"""

from __future__ import annotations

CERT_TEMPLATE_MAP: dict[int, dict[str, str]] = {
    1: {"file": "1. 준법의식 수료증.pptx", "code": "10", "title": "준법의식교육"},
    2: {"file": "2. 음주운전예방 수료증.pptx", "code": "20", "title": "음주운전예방교육"},
    3: {"file": "3. 마약예방 수료증.pptx", "code": "30", "title": "마약예방교육"},
    4: {"file": "4. 학교폭력예방 수료증.pptx", "code": "40", "title": "학교폭력예방교육"},
    5: {"file": "5. 성범죄예방 수료증.pptx", "code": "50", "title": "성범죄예방교육"},
    6: {"file": "6. 성매매예방 수료증.pptx", "code": "60", "title": "성매매예방교육"},
    7: {"file": "7. 디지털성범죄예방 수료증.pptx", "code": "70", "title": "디지털성범죄예방교육"},
    8: {"file": "8. 도박예방 수료증.pptx", "code": "80", "title": "도박예방교육"},
    9: {"file": "9. 피싱범죄예방 수료증.pptx", "code": "90", "title": "피싱범죄예방교육"},
    10: {"file": "10. 재산범죄예방 수료증.pptx", "code": "100", "title": "재산범죄예방교육"},
    11: {"file": "11. 스토킹범죄예방 수료증.pptx", "code": "110", "title": "스토킹범죄예방교육"},
}


def get_cert_template(course_id: int) -> dict[str, str] | None:
    """course_id 로 템플릿 정보 조회. 없으면 None — 호출부에서 명시적으로 처리."""
    return CERT_TEMPLATE_MAP.get(course_id)
