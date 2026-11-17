"use client";

import { useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";

// 후기 쓰기 도우미 문구(2026-11). 별점만 누르고 가는 분들이 많아, 누르면
// 글상자에 문장이 들어가는 짧은 문구 버튼을 띄운다. AI 생성이 아니라 고객이
// 직접 고르는 예시 문구 — 고른 뒤 고치거나 이어 쓸 수 있다.
// 매번 같은 문구만 보이면 후기가 다 비슷해지니, 큰 풀에서 섞어서 일부만 보여준다.

const POSITIVE_COMMON = [
  "설명이 쉬워서 이해가 잘 됐어요.",
  "생각보다 내용이 알차서 놀랐습니다.",
  "제 행동을 돌아보는 계기가 되었습니다.",
  "실제 사례 위주라 와닿았어요.",
  "다시는 같은 실수를 하지 않겠다고 다짐했습니다.",
  "혼자서는 몰랐던 부분을 알게 됐어요.",
  "영상 길이가 적당해서 집중하기 좋았어요.",
  "법적으로 어떤 문제가 되는지 정확히 알게 됐습니다.",
  "모바일로도 편하게 들을 수 있어서 좋았어요.",
  "수료증 발급까지 과정이 간단했습니다.",
  "피해를 입은 분들의 입장을 생각해 보게 됐어요.",
  "막막했는데 무엇을 준비해야 할지 정리가 됐습니다.",
  "강의 내용이 체계적으로 잘 정리되어 있어요.",
  "앞으로 어떻게 살아야 할지 진지하게 고민하게 됐습니다.",
  "필요한 내용만 담겨 있어서 시간 낭비가 없었어요.",
  "주변 사람들에게도 추천하고 싶은 강의입니다.",
  "가족에게 미안한 마음이 더 커졌습니다.",
  "처음엔 형식적일 줄 알았는데 많이 배웠어요.",
  "재발 방지를 위해 꼭 필요한 교육이었다고 생각합니다.",
  "차분하게 다시 생각해 볼 수 있는 시간이었어요.",
  "어려운 법률 용어도 쉽게 풀어 주셔서 좋았습니다.",
  "중간에 멈췄다가 이어 볼 수 있어서 편했어요.",
  "제 잘못의 무게를 다시 느끼게 됐습니다.",
  "반성문 쓸 때도 도움이 될 것 같아요.",
];

const POSITIVE_BY_CATEGORY: Record<string, string[]> = {
  성범죄: [
    "동의의 의미를 제대로 알게 됐습니다.",
    "디지털 성범죄가 얼마나 큰 피해를 주는지 깨달았어요.",
    "가볍게 생각했던 행동들이 범죄가 될 수 있다는 걸 알았습니다.",
    "피해자의 고통을 구체적으로 생각해 보게 됐어요.",
    "온라인에서의 행동도 더 조심하겠습니다.",
  ],
  폭력: [
    "감정을 다스리는 방법을 배울 수 있었어요.",
    "화가 날 때 어떻게 해야 하는지 알게 됐습니다.",
    "말과 행동이 상대에게 어떤 상처가 되는지 느꼈어요.",
    "스토킹이 어디서부터 범죄인지 명확히 알게 됐습니다.",
  ],
  재산범죄: [
    "작은 일이라도 남의 재산을 함부로 하면 안 된다는 걸 느꼈어요.",
    "피해자가 겪는 경제적, 정신적 피해를 이해하게 됐습니다.",
    "보이스피싱 연루가 얼마나 무거운 일인지 알게 됐어요.",
    "돈 문제는 더 신중하게 판단하겠습니다.",
  ],
  "약물·도박": [
    "중독이 생활 전체를 무너뜨린다는 걸 실감했어요.",
    "끊기 위해 무엇부터 해야 할지 알게 됐습니다.",
    "도움받을 수 있는 기관을 알게 되어 좋았어요.",
    "한 번쯤은 괜찮다는 생각이 위험하다는 걸 깨달았습니다.",
  ],
  교통: [
    "음주운전이 얼마나 위험한지 다시 느꼈어요.",
    "술을 마시면 절대 운전대를 잡지 않겠습니다.",
    "사고 사례를 보면서 정신이 번쩍 들었어요.",
    "대리운전이나 대중교통을 꼭 이용하겠습니다.",
  ],
  준법의식: [
    "법을 지키는 게 왜 중요한지 다시 생각하게 됐어요.",
    "사소한 규칙도 가볍게 넘기지 않겠습니다.",
    "제 행동이 사회에 어떤 영향을 주는지 돌아봤어요.",
    "앞으로는 더 신중하게 판단하며 살겠습니다.",
  ],
  심리상담: [
    "상담 선생님이 이야기를 잘 들어 주셔서 마음이 편해졌어요.",
    "제 마음 상태를 객관적으로 볼 수 있었습니다.",
    "혼자 버티던 부분을 털어놓을 수 있어서 좋았어요.",
    "앞으로 어떻게 해야 할지 방향이 잡혔습니다.",
  ],
};

const MIXED = [
  "도움은 됐지만 조금 더 자세했으면 좋겠어요.",
  "내용은 좋았는데 영상이 조금 길게 느껴졌어요.",
  "기본적인 내용 위주라 아쉬웠습니다.",
  "사례가 더 다양했으면 좋겠어요.",
  "전반적으로 무난했습니다.",
];

const NEGATIVE = [
  "기대했던 것과 내용이 달랐어요.",
  "내용이 너무 짧게 느껴졌습니다.",
  "설명이 조금 어려웠어요.",
  "제 상황에 맞는 내용이 부족했습니다.",
  "영상 재생이 불편했어요.",
  "가격에 비해 아쉬웠습니다.",
];

// 시드가 같으면 같은 순서 — 렌더 중에 Math.random 을 부르지 않으려고.
function rng(seed: number): () => number {
  let t = Math.floor(seed * 2 ** 32) >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWith<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickPhrases(
  rating: number,
  category: string | null | undefined,
  count: number,
  seed: number,
): string[] {
  const rand = rng(seed);
  const shuffle = <T,>(arr: T[]) => shuffleWith(arr, rand);
  if (rating <= 2) return shuffle(NEGATIVE).slice(0, count);
  if (rating === 3) return shuffle([...MIXED, ...NEGATIVE.slice(0, 3)]).slice(0, count);
  const own = shuffle((category && POSITIVE_BY_CATEGORY[category]) || []).slice(0, 2);
  const rest = shuffle(POSITIVE_COMMON).slice(0, count - own.length);
  const mixed = rating === 4 ? [...rest.slice(0, -1), shuffle(MIXED)[0]] : rest;
  return shuffle([...own, ...mixed]);
}

// 이어 붙일 때 앞 글과 띄어 쓴다.
function appendPhrase(text: string, phrase: string): string {
  const t = text.trimEnd();
  return t ? `${t} ${phrase}` : phrase;
}

function removePhrase(text: string, phrase: string): string {
  return text.replace(phrase, "").replace(/\s{2,}/g, " ").trim();
}

export function ReviewPhraseChips({
  rating,
  category,
  value,
  onChange,
  maxLength,
  count = 5,
}: {
  rating: number;
  category?: string | null;
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  count?: number;
}) {
  // 폼을 열 때마다 다른 시드 → 다른 문구. "다른 문구"를 누르면 새 시드.
  const [seed, setSeed] = useState(() => Math.random());
  const phrases = useMemo(
    () => pickPhrases(rating, category, count, seed),
    [rating, category, count, seed],
  );

  if (rating < 1) return null;

  return (
    <div className="text-left">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-500">눌러서 문장 넣기</span>
        <button
          type="button"
          onClick={() => setSeed(Math.random())}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-700"
        >
          <RefreshCw className="h-3 w-3" /> 다른 문구
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {phrases.map((p) => {
          const used = value.includes(p);
          const tooLong = !used && maxLength != null && appendPhrase(value, p).length > maxLength;
          return (
            <button
              key={p}
              type="button"
              disabled={tooLong}
              onClick={() => onChange(used ? removePhrase(value, p) : appendPhrase(value, p))}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-left text-xs font-semibold leading-snug transition-colors disabled:opacity-40 ${
                used
                  ? "border-[var(--color-accent)] bg-blue-50 text-[var(--color-accent)]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              {used ? null : <Plus className="h-3 w-3 shrink-0" />}
              {p}
            </button>
          );
        })}
      </div>
    </div>
  );
}
