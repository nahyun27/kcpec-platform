"""반성문·탄원서 본문 AI 자동 작성 — Gemini API 호출.

심리상담 의견서(gemini_client.py)와 가장 큰 차이: 여기는 관리자 검토 단계가
없다. 생성된 텍스트가 그대로 즉시 고객에게 발급되므로, 실패 시 더미 텍스트로
조용히 폴백하면 안 된다 — 고객이 엉성한 안내 문구가 그대로 박힌 "법원
제출용" 문서를 받게 되는 사고로 이어진다. 그래서 이 모듈은 실패하면 그냥
예외를 던지고, 호출부(legal_letters.py)가 502 로 고객에게 "다시 시도해
주세요"를 보여준다 — 주문은 이미 결제된 상태로 남아 재시도할 수 있다.

선택사항/질문 구성(answers 의 키)은 의뢰인이 추후 확정할 예정이라 당분간
자유 dict 로 받는다 — 서식 원본(docx)의 작성 유의사항에 있던 권장 항목을
기본값으로 잡아 두었다(사건 경위/잘못을 깨달은 점/재범 방지 노력 등).
"""

from __future__ import annotations

import time
from textwrap import dedent

from app.core.config import settings

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

# 선택사항/질문의 기본값 — 서식 원본 유의사항에 있던 권장 순서를 그대로 따름.
# 의뢰인이 실제 문항을 확정하면 이 라벨과 프론트 폼을 함께 교체할 것.
DEFAULT_QUESTION_LABELS: dict[str, dict[str, str]] = {
    "repentance": {
        "case_summary": "사건 경위",
        "realization": "잘못을 깨달은 점",
        "apology": "피해자에 대한 사과",
        "prevention_effort": "재범 방지를 위한 구체적인 노력과 다짐",
    },
    "petition": {
        "acquaintance_period": "피고인과의 관계 및 알고 지낸 기간",
        "defendant_character": "평소 피고인의 모습",
        "change_since_incident": "사건 이후 달라진 점",
        "support_plan": "앞으로 도울 수 있는 일",
    },
}


def _format_user_prompt(
    *, letter_type: str, charge_or_defendant: str, answers: dict[str, str]
) -> str:
    labels = DEFAULT_QUESTION_LABELS.get(letter_type, {})
    lines = [f"■ {labels.get(k, k)}: {(v or '').strip() or '(미입력)'}" for k, v in answers.items()]
    subject_line = (
        f"- 죄명: {charge_or_defendant}"
        if letter_type == "repentance"
        else f"- 피고인(피의자): {charge_or_defendant}"
    )
    return dedent(
        f"""\
        다음 정보를 바탕으로 {"반성문" if letter_type == "repentance" else "탄원서"} 본문을
        작성해 주세요.

        {subject_line}

        [답변]
        {chr(10).join(lines)}
        """
    )


class LegalLetterAIError(RuntimeError):
    """AI 생성 실패 — 호출부가 502 로 변환해 고객에게 재시도를 안내한다."""


def generate_legal_letter_content(
    *,
    letter_type: str,
    charge_or_defendant: str,
    answers: dict[str, str],
    max_attempts: int = 3,
) -> str:
    if not settings.GEMINI_API_KEY:
        raise LegalLetterAIError("GEMINI_API_KEY 미설정 — 로컬 개발 환경에서는 자동 작성을 쓸 수 없습니다.")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    system_prompt = SYSTEM_PROMPTS.get(letter_type)
    if system_prompt is None:
        raise LegalLetterAIError(f"알 수 없는 서식 종류: {letter_type}")

    contents = _format_user_prompt(
        letter_type=letter_type, charge_or_defendant=charge_or_defendant, answers=answers
    )

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


__all__ = [
    "DEFAULT_QUESTION_LABELS",
    "LegalLetterAIError",
    "generate_legal_letter_content",
]
