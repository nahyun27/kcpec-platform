"""반성문·탄원서 본문 AI 자동 작성 — Gemini API 호출.

심리상담 의견서(gemini_client.py)와 가장 큰 차이: 여기는 관리자 검토 단계가
없다. 생성된 텍스트가 그대로 즉시 고객에게 발급되므로, 실패 시 더미 텍스트로
조용히 폴백하면 안 된다 — 고객이 엉성한 안내 문구가 그대로 박힌 "법원
제출용" 문서를 받게 되는 사고로 이어진다. 그래서 이 모듈은 실패하면 그냥
예외를 던지고, 호출부(legal_letters.py)가 502 로 고객에게 "다시 시도해
주세요"를 보여준다 — 주문은 이미 결제된 상태로 남아 재시도할 수 있다.

입력 항목(선택사항 + 자유 서술 내용)은 의뢰인이 확정한 구성을 그대로 따른다
(2026-09):
  반성문 — 초범 여부/동종전과, 사건 진행단계, 합의 여부(선택) +
           사건 경위/잘못을 깨달은 점/사과/재범방지 노력(자유 서술, 기존 유지)
  탄원서 — (구조화 항목 없음, 의뢰인이 별도로 요청 안 함) +
           관계·기간/평소 모습/달라진 점/도울 일(자유 서술, 기존 유지)
"""

from __future__ import annotations

import time
from textwrap import dedent

from app.core.config import settings

# 사건 진행단계 — 의뢰인이 문자로 전달한 원문 그대로(2026-09-23).
CASE_STAGE_OPTIONS = [
    "경찰 조사 단계",
    "검찰 송치 / 기소 단계",
    "1심 재판 진행 중",
    "항소심 진행 중",
    "누범기간/집행유예",
    "구치소 / 교도소 수감중",
]

# 합의 여부 — 의뢰인이 "여부"라고만 전달해 실무적으로 흔한 4단계로 잠정
# 구성함(진행 중 상태를 구분해야 자연스러운 문장이 나옴) — 확정 전 임시값.
SETTLEMENT_STATUS_OPTIONS = [
    "합의 완료",
    "합의 진행 중",
    "합의하지 못함",
    "피해자 없음(해당 없음)",
]

SYSTEM_PROMPTS: dict[str, str] = {
    "repentance": dedent(
        """\
        당신은 법원에 제출할 반성문 작성을 돕는 도우미입니다. 아래 입력된 사건
        정보와 작성자 본인의 답변을 바탕으로, 작성자가 직접 쓴 것처럼 1인칭
        시점의 반성문 본문을 작성합니다.

        작성 원칙 (반드시 지킬 것):
        - '존경하는 판사님/재판장님' 등 수신자 호칭은 쓰지 않는다.
        - 변명이나 책임 전가가 아니라, 자신의 행동과 그 결과를 있는 그대로
          인정하는 데 초점을 둔다.
        - 입력된 답변에 없는 구체적 사실(날짜·장소·금액·이름 등)을 임의로
          지어내지 않는다 — 답변 내용을 자연스러운 문장으로 풀어 쓰는 것까지만
          한다.
        - 초범/동종전과 여부, 사건 진행단계, 합의 여부는 직접 인용하듯 나열하지
          말고, 반성의 맥락(예: 재범인 경우 더 깊은 반성, 합의가 됐다면 감사
          인사, 진행 중이면 성실히 임하겠다는 다짐)에 자연스럽게 녹여 쓴다.
        - 문어체 존댓말(합니다체)로 진솔하고 담백하게 쓴다. 과장된 수사나
          상투적 문구를 피한다.
        - Markdown 기호(#, *, - 등)를 쓰지 않는다.
        - 출력은 본문 문단들로만 구성한다 — 제목/날짜/서명/수신처는 포함하지
          않는다(서식에 별도로 들어간다).
        """
    ),
    "petition": dedent(
        """\
        당신은 법원에 제출할 탄원서 작성을 돕는 도우미입니다. 아래 입력된 사건
        정보와 탄원인 본인의 답변을 바탕으로, 탄원인이 직접 쓴 것처럼 1인칭
        시점의 탄원서 본문을 작성합니다.

        작성 원칙 (반드시 지킬 것):
        - '존경하는 판사님/재판장님' 등 수신자 호칭은 쓰지 않는다.
        - 막연한 선처 호소가 아니라, 탄원인이 직접 보고 겪은 구체적인 사실
          위주로 쓴다.
        - 입력된 답변에 없는 구체적 사실을 임의로 지어내지 않는다.
        - 문어체 존댓말(합니다체)로 진솔하고 담백하게 쓴다.
        - Markdown 기호를 쓰지 않는다.
        - 출력은 본문 문단들로만 구성한다(제목/날짜/서명/수신처 제외).
        """
    ),
}

# 자유 서술 질문 라벨 — 서식 원본 유의사항에 있던 권장 항목을 그대로 따름.
FREE_TEXT_QUESTION_LABELS: dict[str, dict[str, str]] = {
    "repentance": {
        "case_summary": "사건 경위",
        "realization": "잘못을 깨달은 점",
        "apology": "피해자에 대한 사과",
        "prevention_effort": "재범 방지를 위한 구체적인 노력과 다짐",
    },
    "petition": {
        "acquaintance_period": "사건당사자와의 관계 및 알고 지낸 기간",
        "defendant_character": "평소 사건당사자의 모습",
        "change_since_incident": "사건 이후 달라진 점",
        "support_plan": "앞으로 도울 수 있는 일",
    },
}


def _format_repentance_prompt(
    *,
    charge: str,
    first_offense: bool,
    prior_same_type_record: bool | None,
    case_stage: str,
    settlement_status: str,
    answers: dict[str, str],
) -> str:
    if first_offense:
        record_line = "초범임"
    elif prior_same_type_record:
        record_line = "재범이며 동종 전과 있음"
    else:
        record_line = "재범이나 동종 전과는 없음"

    labels = FREE_TEXT_QUESTION_LABELS["repentance"]
    answer_lines = [f"■ {labels.get(k, k)}: {(v or '').strip() or '(미입력)'}" for k, v in answers.items()]
    return dedent(
        f"""\
        다음 정보를 바탕으로 반성문 본문을 작성해 주세요.

        - 죄명: {charge}
        - 전과 관계: {record_line}
        - 현재 사건 진행단계: {case_stage}
        - 상대방과 합의 여부: {settlement_status}

        [답변]
        {chr(10).join(answer_lines)}
        """
    )


def _format_petition_prompt(
    *, charge: str, defendant_name: str, relationship: str, answers: dict[str, str]
) -> str:
    labels = FREE_TEXT_QUESTION_LABELS["petition"]
    answer_lines = [f"■ {labels.get(k, k)}: {(v or '').strip() or '(미입력)'}" for k, v in answers.items()]
    return dedent(
        f"""\
        다음 정보를 바탕으로 탄원서 본문을 작성해 주세요.

        - 사건당사자: {defendant_name}
        - 탄원인과 사건당사자의 관계: {relationship}
        - 죄명: {charge}

        [답변]
        {chr(10).join(answer_lines)}
        """
    )


class LegalLetterAIError(RuntimeError):
    """AI 생성 실패 — 호출부가 502 로 변환해 고객에게 재시도를 안내한다."""


def _call_gemini(*, system_prompt: str, contents: str, max_attempts: int) -> str:
    if not settings.GEMINI_API_KEY:
        raise LegalLetterAIError("GEMINI_API_KEY 미설정 — 로컬 개발 환경에서는 자동 작성을 쓸 수 없습니다.")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    last_exc: Exception | None = None
    for attempt in range(max_attempts):
        try:
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=contents,
                config=types.GenerateContentConfig(system_instruction=system_prompt),
            )
            text = (response.text or "").strip()
            if text:
                return text
            raise LegalLetterAIError("AI 응답이 비어 있습니다.")
        except Exception as e:  # noqa: BLE001
            last_exc = e
            if attempt < max_attempts - 1:
                time.sleep(3 * (attempt + 1))
                continue
            break

    raise LegalLetterAIError(f"AI 자동 작성에 실패했습니다: {last_exc}") from last_exc


def generate_repentance_content(
    *,
    charge: str,
    first_offense: bool,
    prior_same_type_record: bool | None,
    case_stage: str,
    settlement_status: str,
    answers: dict[str, str],
    max_attempts: int = 3,
) -> str:
    contents = _format_repentance_prompt(
        charge=charge,
        first_offense=first_offense,
        prior_same_type_record=prior_same_type_record,
        case_stage=case_stage,
        settlement_status=settlement_status,
        answers=answers,
    )
    return _call_gemini(
        system_prompt=SYSTEM_PROMPTS["repentance"], contents=contents, max_attempts=max_attempts
    )


def generate_petition_content(
    *,
    charge: str,
    defendant_name: str,
    relationship: str,
    answers: dict[str, str],
    max_attempts: int = 3,
) -> str:
    contents = _format_petition_prompt(
        charge=charge, defendant_name=defendant_name, relationship=relationship, answers=answers
    )
    return _call_gemini(
        system_prompt=SYSTEM_PROMPTS["petition"], contents=contents, max_attempts=max_attempts
    )


__all__ = [
    "CASE_STAGE_OPTIONS",
    "SETTLEMENT_STATUS_OPTIONS",
    "FREE_TEXT_QUESTION_LABELS",
    "LegalLetterAIError",
    "generate_repentance_content",
    "generate_petition_content",
]
