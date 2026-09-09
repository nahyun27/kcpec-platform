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



# 더미 초안 식별용 마커 — 이 문자열이 본문에 있으면 실제 AI 초안이 아니라
# 폴백(dummy) 텍스트라는 뜻. GEMINI_API_KEY 미설정뿐 아니라 키가 유효하지
# 않거나 API 호출이 실패한 경우에도 동일하게 폴백되므로, 호출자(이메일 제목
# 경고 표시 등)는 설정값(settings.GEMINI_API_KEY)이 아니라 이 마커로 판단해야
# 실제로 더미가 나갔는지를 정확히 알 수 있다.
DUMMY_DRAFT_MARKER = "[시스템 점검용 더미 텍스트]"

# 구글 서버 자체의 일시적 과부하(503 UNAVAILABLE 등)로 실패한 경우를 구분하는
# 마커 — 이때는 우리 쪽 설정/코드 문제가 아니라 잠시 후 재시도하면 되는
# 상황이므로, 관리자에게 "뭔가 고장났다"가 아니라 "다시 시도해보라"고
# 알려줄 수 있게 별도로 표시한다.
TRANSIENT_OVERLOAD_MARKER = "[일시적 서버 과부하]"


def is_dummy_draft(draft_text: str) -> bool:
    return DUMMY_DRAFT_MARKER in draft_text


def is_transient_overload_draft(draft_text: str) -> bool:
    return TRANSIENT_OVERLOAD_MARKER in draft_text


def _is_transient_overload(exc: Exception) -> bool:
    # google.genai.errors.APIError 는 .code(int)/.status(str) 를 갖는다
    # (예: code=503, status="UNAVAILABLE"). 그 외 라이브러리가 바뀌어도
    # 최소한 메시지 문구로는 판별되게 문자열 검사도 함께 둔다.
    code = getattr(exc, "code", None)
    status_field = getattr(exc, "status", None)
    if code == 503 or status_field == "UNAVAILABLE":
        return True
    text = str(exc).lower()
    return "unavailable" in text or "high demand" in text or "overloaded" in text


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

    try:
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
    except Exception as e:
        # 키가 유효하지 않거나(발급/설정 오류), 쿼터 초과, 네트워크 오류 등 —
        # 원인이 무엇이든 호출자는 반드시 초안 텍스트를 받아야 흐름이
        # 끊기지 않는다(설문 자동 초안 생성 실패 시 아무 신호 없이 조용히
        # 멈추는 사고를 방지). 실제 원인은 로그로 남기고, 눈에 띄는 더미
        # 텍스트로 폴백해 관리자가 반드시 재검토하게 한다.
        logger.exception("Gemini API 호출 실패 — 더미 초안으로 폴백")
        return _dummy_draft(
            survey_responses, course_title, transient=_is_transient_overload(e)
        )


def _dummy_draft(
    survey_responses: dict, course_title: str, transient: bool = False
) -> str:
    """AI 초안 생성이 불가능하거나 실패했을 때 대신 반환하는 더미 초안.
    document_generator 가 기대하는 [상담배경]/[상담내용] 섹션 포맷 유지.
    """
    if transient:
        cause_line = (
            f"1. 본 초안은 {DUMMY_DRAFT_MARKER}으로, {TRANSIENT_OVERLOAD_MARKER}"
            " Google Gemini 서버가 일시적으로 과부하 상태라 자동 생성에 실패하여"
            " 대신 표시됨 — 저희 쪽 문제가 아니니 잠시 후 '다시 생성'을 눌러주세요."
        )
    else:
        cause_line = (
            f"1. 본 초안은 {DUMMY_DRAFT_MARKER}으로, AI 자동 초안 생성이"
            " 불가능하거나 실패하여 대신 표시됨(관리자 확인 필요)."
        )
    return dedent(
        f"""\
        [상담배경]
        {cause_line}
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


__all__ = [
    "generate_counseling_draft",
    "is_dummy_draft",
    "is_transient_overload_draft",
    "DUMMY_DRAFT_MARKER",
    "TRANSIENT_OVERLOAD_MARKER",
]
