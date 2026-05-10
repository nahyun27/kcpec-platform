"""Claude API 호출 — 심리상담 의견서 초안 생성.

ANTHROPIC_API_KEY 가 비어 있으면 더미 초안을 돌려준다 (로컬 개발용).
"""

from __future__ import annotations

import logging
from textwrap import dedent

from app.core.config import settings

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = dedent(
    """\
    당신은 한국범죄예방교육센터 소속 전문 심리상담사입니다.
    내담자의 설문 응답을 바탕으로 법원 제출용 심리상담 의견서 초안을 작성합니다.

    작성 원칙:
    - 반드시 [상담배경]과 [상담내용] 두 섹션으로 작성
    - 각 섹션은 번호 목록 형식 (1. 2. 3. ...)
    - 문장 끝맺음: ~함. ~음. ~있음. (공문서 어체)
    - 설문 내용에 근거하되 내담자에게 유리한 방향으로 서술
    - 피해자 공감, 반성의 진정성, 재범 방지 의지 강조
    - [상담배경]: 3항목 (사건경위, 심리상태, 상담목적)
    - [상담내용]: 5항목 (범행인식, 심리특성, 재범방지계획, 지지체계, 종합의견/예후)
    - 종합의견 마지막 문장은 반드시 재범 가능성 낮음으로 마무리
    """
)


def _format_personal(personal: dict | None) -> str:
    """personal 딕셔너리를 한 줄 요약 문자열로 직렬화."""
    if not isinstance(personal, dict) or not personal:
        return "(인적사항 미입력)"
    parts = []
    name = personal.get("name") or ""
    gender = personal.get("gender") or ""
    age = personal.get("age")
    head = ", ".join(x for x in [name, gender, (f"{age}세" if age else "")] if x)
    if head:
        parts.append(head)
    if personal.get("birthdate"):
        parts.append(f"생년월일 {personal['birthdate']}")
    if personal.get("job"):
        parts.append(f"직업 {personal['job']}")
    if personal.get("education"):
        parts.append(f"학력 {personal['education']}")
    if personal.get("family"):
        parts.append(f"가족관계 {personal['family']}")
    cr = personal.get("criminal_record") or ""
    if cr:
        cd = personal.get("criminal_detail") or ""
        parts.append(f"전과 {cr}{f' ({cd})' if cd and cr == '있음' else ''}")
    if personal.get("health"):
        parts.append(f"건강상태 {personal['health']}")
    if personal.get("military"):
        parts.append(f"병역 {personal['military']}")
    return " / ".join(parts)


def _format_user_prompt(
    survey_responses: dict, course_title: str
) -> str:
    """신형(personal dict + q2..q6) / 구형(인적사항 등 자유 텍스트) 모두 수용."""
    personal = survey_responses.get("personal")
    legacy_personal = survey_responses.get("인적사항", "")
    personal_summary = (
        _format_personal(personal)
        if isinstance(personal, dict)
        else (str(legacy_personal) or "(인적사항 미입력)")
    )

    def get(key: str, legacy_key: str) -> str:
        v = survey_responses.get(key)
        if v is None:
            v = survey_responses.get(legacy_key, "")
        return str(v or "").strip() or "(미입력)"

    return dedent(
        f"""\
        다음 정보를 바탕으로 심리상담 의견서 초안을 작성해 주세요.

        - 이수 교육 과정: {course_title}

        [내담자 인적사항]
        {personal_summary}

        [설문 응답]
        ■ 상담 의뢰 내용 (사건 경위): {get('q2', '사건내용')}
        ■ 현재 심리 상태 및 반성: {get('q3', '후회되는점')}
        ■ 범행에 대한 인식 / 우려사항: {get('q4', '걱정되는점')}
        ■ 재범 방지 계획: {get('q5', '재범방지노력')}
        ■ 기타 사항: {get('q6', '하고싶은말')}
        """
    )


def _dummy_draft(survey_responses: dict, course_title: str) -> str:
    """ANTHROPIC_API_KEY 미설정 시 사용되는 더미 초안.
    document_generator 가 기대하는 [상담배경] / [상담내용] 섹션 포맷을 따른다.
    """
    return dedent(
        f"""\
        [상담배경]
        1. 본 초안은 ANTHROPIC_API_KEY 미설정 환경에서 생성된 시스템 점검용 더미 텍스트임.
        2. 내담자는 '{course_title}' 교육 과정을 이수하고 본 상담에 참여함.
        3. 본 상담은 내담자의 심리상태 평가 및 재범방지 계획 수립을 목적으로 진행됨.

        [상담내용]
        1. 내담자는 사건에 대해 인식하고 있으며 반성의 의지를 보임.
        2. 내담자의 심리적 특성에 대한 추가 평가가 필요함.
        3. 향후 재범 방지를 위한 구체적인 계획 수립이 권고됨.
        4. 가족 및 직장 등 지지체계 확인이 필요함.
        5. 본 초안은 더미 텍스트로 실제 발송 전 반드시 검토 후 재작성이 필요함. 재범 가능성은 추가 평가를 통해 판단 가능함.
        """
    )


def generate_counseling_draft(survey_responses: dict, course_title: str) -> str:
    if not settings.ANTHROPIC_API_KEY:
        logger.info("ANTHROPIC_API_KEY 미설정 — 더미 초안 반환")
        return _dummy_draft(survey_responses, course_title)

    # Lazy import: anthropic 가 없거나 API 키만 비어 있는 환경에서 import 비용을 회피.
    from anthropic import Anthropic

    client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    msg = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": _format_user_prompt(survey_responses, course_title)}
        ],
    )
    parts: list[str] = []
    for block in msg.content:
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
    return "\n".join(parts).strip() or _dummy_draft(survey_responses, course_title)
