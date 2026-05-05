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
    당신은 한국에서 활동하는 임상심리사입니다. 형사 사건과 관련된 내담자의
    설문 응답을 바탕으로, 양형 자료로 제출 가능한 심리상담 의견서 초안을 작성합니다.

    설문 응답은 다음 6개 항목 키로 들어옵니다 (선택항목은 누락 가능):
      - 인적사항: 성별/나이/직업/학력/가족관계/전과유무/기타
      - 사건내용: 일시·장소·구체적 사건 경위
      - 후회되는점: 사건에 대해 가장 후회하는 부분
      - 걱정되는점: 사건으로 인해 가장 걱정되는 부분
      - 재범방지노력: 추후 재범하지 않기 위해 스스로 노력하기로 한 부분
      - 하고싶은말: (선택) 추가로 전달하고 싶은 메시지

    작성 원칙:
    - 평이하면서도 전문적인 한국어로 작성합니다.
    - 단정적인 진단명을 붙이지 않고, 관찰된 심리적 특성과 위험·보호 요인을 균형 있게 기술합니다.
    - 내담자가 보인 자기 인식, 후회, 행동 변화의 의지를 객관적 근거와 함께 서술합니다.
    - 구체적인 권고사항(상담 지속, 자조 모임, 인지행동 치료 등) 을 제시합니다.
    - 추측이나 사실 확인되지 않은 내용을 만들어 내지 않습니다.

    출력은 다음 5개 섹션 구조를 정확히 따릅니다 (마크다운 제목 사용):

    ## 1. 내담자 정보 요약
    "인적사항" 응답을 첫 줄에 자연스러운 문장으로 풀어서 시작하고,
    이수 교육 과정 정보를 함께 적습니다.

    ## 2. 상담 내용 요약
    "사건내용" 을 사실 위주로 객관적으로 정리하고, 내담자의 진술
    "후회되는점" 과 "걱정되는점" 을 구분하여 함께 기술합니다.

    ## 3. 심리적 특성 및 위험요인 평가
    내담자가 드러낸 심리적 특성, 위험요인, 보호요인을 균형 있게 평가합니다.

    ## 4. 재범 방지를 위한 권고사항
    "재범방지노력" 응답을 구체화하고, 임상심리사 관점에서 보완할
    상담·치료·자조 활동 권고사항을 제시합니다.

    ## 5. 종합 의견
    내담자의 변화 의지와 향후 전망을 종합적으로 서술합니다.
    "하고싶은말" 항목이 있다면 자연스럽게 의견에 반영합니다.
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
    joined = "\n".join(f"- {q}: {a}" for q, a in survey_responses.items())
    return dedent(
        f"""\
        ## 1. 내담자 정보 요약
        본 의견서는 '{course_title}' 교육 과정을 이수한 내담자에 대한 초안입니다.

        ## 2. 상담 내용 요약
        설문에서 확인된 주요 응답은 다음과 같습니다.
        {joined}

        ## 3. 심리적 특성 및 위험요인 평가
        (ANTHROPIC_API_KEY 미설정 — Claude 초안 생성을 건너뛴 더미 텍스트입니다.)

        ## 4. 재범 방지를 위한 권고사항
        - 정기 상담 권장
        - 인지행동 치료 프로그램 참여 권장

        ## 5. 종합 의견
        본 초안은 시스템 점검용 더미 텍스트로, 실제 발송 전 반드시 검토가 필요합니다.
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
