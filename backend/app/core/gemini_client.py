"""Gemini API 호출 — 심리상담 의견서 초안 생성.

GEMINI_API_KEY 가 비어 있으면 더미 초안을 돌려준다 (로컬 개발용).
이전엔 Anthropic Claude 를 썼으나(claude_client.py 참고) 현재 운영은
Google Gemini 로 통일.
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

    출력 형식 (엄격):
    - 출력은 정확히 두 섹션으로만 구성: [상담배경] 과 [상담내용].
    - 다른 헤더(수신/참조/발신/일자/제목/내담자 인적사항 등) 절대 추가하지 말 것.
    - Markdown 금지: #, ##, ###, **굵게**, *기울임*, --- 등의 마크다운 기호 사용 금지.
    - 각 섹션은 번호 목록 형식("1. ", "2. ", ...) 으로 시작하는 단락들로 작성.
    - 항목 안에서도 굵게/머리표 같은 강조 기호 사용 금지 (평문 한국어 문장).

    작성 원칙:
    - 문장 끝맺음: ~함. ~음. ~있음. (공문서 어체)
    - 설문 내용에 근거하되 내담자에게 유리한 방향으로 서술.
    - 피해자 공감, 반성의 진정성, 재범 방지 의지 강조.
    - [상담배경]: 정확히 3항목 (사건경위, 심리상태, 상담목적)
    - [상담내용]: 정확히 5항목 (범행인식, 심리특성, 재범방지계획, 지지체계, 종합의견/예후)
    - 종합의견(5번) 마지막 문장은 반드시 재범 가능성 낮음으로 마무리.

    예시 출력 형식:
    [상담배경]
    1. 내담자는 2025년 8월경 ... 본 상담에 참여함.
    2. 내담자는 첫 상담 시 ...
    3. 본 상담은 ... 목적으로 진행됨.

    [상담내용]
    1. 내담자는 ... 명확히 인식하고 있음.
    2. 내담자의 ... 공감 능력은 양호함.
    3. 향후 재범 방지를 위해 ...
    4. 가족 및 직장의 ...
    5. 종합적으로 판단할 때 ... 재범 가능성은 낮음.
    """
)


def _format_personal(personal: dict | None) -> str:
    if not isinstance(personal, dict) or not personal:
        return "(인적사항 미입력)"
    parts: list[str] = []
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
    survey_responses: dict,
    course_title: str,
    extra_instructions: str = "",
) -> str:
    """신형(personal dict + q2..q6) / 구형(인적사항 등 자유 텍스트) 모두 수용.
    extra_instructions: 어드민이 재생성 시 추가로 주는 지시사항(없으면 미포함).
    """
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

    base = dedent(
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
    extra = (extra_instructions or "").strip()
    if extra:
        base += dedent(
            f"""

            [추가 지시 (관리자 요청)]
            아래 지시사항을 반영하여 작성해 주세요. 다만 출력 형식 규칙
            ([상담배경]/[상담내용] 두 섹션, Markdown 금지) 은 그대로 유지할 것.
            {extra}
            """
        )
    return base


def generate_counseling_draft(
    survey_responses: dict,
    course_title: str,
    extra_instructions: str = "",
) -> str:
    if not settings.GEMINI_API_KEY:
        logger.info("GEMINI_API_KEY 미설정 — 더미 초안 반환")
        return _dummy_draft(survey_responses, course_title)

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=_format_user_prompt(
            survey_responses, course_title, extra_instructions
        ),
        config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
    )
    text = (response.text or "").strip()
    return text or _dummy_draft(survey_responses, course_title)


def _dummy_draft(survey_responses: dict, course_title: str) -> str:
    """GEMINI_API_KEY 미설정 시 사용되는 더미 초안.
    document_generator 가 기대하는 [상담배경]/[상담내용] 섹션 포맷 유지.
    """
    return dedent(
        f"""\
        [상담배경]
        1. 본 초안은 GEMINI_API_KEY 미설정 환경에서 생성된 시스템 점검용 더미 텍스트임.
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


__all__ = ["generate_counseling_draft"]
