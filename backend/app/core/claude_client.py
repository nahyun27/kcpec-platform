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


def _format_user_prompt(survey_responses: dict[str, str], course_title: str) -> str:
    bullet_lines = "\n".join(
        f"- **{question}**\n  {answer}" for question, answer in survey_responses.items()
    )
    return dedent(
        f"""\
        다음 정보를 바탕으로 심리상담 의견서 초안을 작성해 주세요.

        - 이수 교육 과정: {course_title}
        - 설문 응답:

        {bullet_lines}
        """
    )


def _dummy_draft(survey_responses: dict[str, str], course_title: str) -> str:
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


def generate_counseling_draft(survey_responses: dict[str, str], course_title: str) -> str:
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
