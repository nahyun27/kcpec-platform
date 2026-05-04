"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { submitSurvey, tokenStorage } from "@/lib/api";

const QUESTIONS: string[] = [
  "이번 사건에 대해 어떻게 생각하시나요?",
  "가장 후회되는 점은 무엇인가요?",
  "피해자나 주변 사람들에게 어떤 영향을 미쳤다고 생각하시나요?",
  "앞으로 어떻게 달라질 것인지 구체적으로 적어주세요.",
  "현재 가장 걱정되는 점은 무엇인가요?",
];

export default function SurveyClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("order_id");
  const orderId = orderIdParam ? Number(orderIdParam) : NaN;

  const [answers, setAnswers] = useState<string[]>(() => QUESTIONS.map(() => ""));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(orderId)) {
      setError("잘못된 접근입니다. (order_id 누락)");
      return;
    }
    if (!tokenStorage.getAccess()) {
      router.replace(`/login?next=/survey?order_id=${orderId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  function update(idx: number, value: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }

  async function handleSubmit() {
    if (answers.some((a) => !a.trim())) {
      setError("모든 문항에 답변해 주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const responses: Record<string, string> = {};
      QUESTIONS.forEach((q, i) => {
        responses[q] = answers[i].trim();
      });
      await submitSurvey(orderId, responses);
      setSubmitted(true);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "설문 제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !submitted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Link
          href="/mypage"
          className="mt-6 inline-block rounded bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
        >
          마이페이지로
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-8 text-center shadow-sm">
          <p className="font-sans text-2xl font-bold text-[var(--color-primary)]">
            설문이 제출되었습니다
          </p>
          <p className="mt-3 text-sm text-zinc-700">
            전문 상담사가 검토 후 24시간 이내에 이메일로 의견서를 전달드립니다.
          </p>
          <p className="mt-2 text-xs text-zinc-500">진행 상황은 마이페이지에서 확인하실 수 있습니다.</p>
          <div className="mt-8 flex flex-col gap-2">
            <Link
              href="/mypage"
              className="rounded bg-[var(--color-primary)] py-3 font-semibold text-white hover:bg-[var(--color-primary-hover)]"
            >
              마이페이지로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const total = QUESTIONS.length;
  const isLast = currentIdx === total - 1;
  const currentValue = answers[currentIdx];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <p className="text-xs font-medium text-[var(--color-accent)]">
          문항 {currentIdx + 1} / {total}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full bg-[var(--color-primary)] transition-[width]"
            style={{ width: `${((currentIdx + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-white p-6 shadow-sm">
        <h2 className="font-sans text-xl font-semibold leading-relaxed text-zinc-900">
          {QUESTIONS[currentIdx]}
        </h2>

        <textarea
          value={currentValue}
          onChange={(e) => update(currentIdx, e.target.value)}
          rows={7}
          maxLength={2000}
          placeholder="가능한 한 솔직하고 구체적으로 적어주세요."
          className="mt-4 w-full resize-y rounded border border-[var(--color-border)] px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-zinc-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
        />
        <p className="mt-1 text-right text-xs text-zinc-400">
          {currentValue.length} / 2000
        </p>

        {error ? (
          <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-between gap-2">
          <button
            type="button"
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="rounded border border-[var(--color-border)] px-4 py-2 text-sm text-zinc-700 disabled:opacity-40"
          >
            이전
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !currentValue.trim()}
              className="rounded bg-[var(--color-primary)] px-6 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
            >
              {submitting ? "제출 중..." : "제출하기"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
              disabled={!currentValue.trim()}
              className="rounded bg-[var(--color-primary)] px-6 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
            >
              다음
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
