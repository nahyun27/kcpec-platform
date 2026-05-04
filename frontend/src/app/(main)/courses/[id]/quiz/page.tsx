"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { getQuiz, submitQuiz } from "@/lib/api";
import type { QuizDetail, QuizResult } from "@/types/course";

export default function QuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const courseId = Number(id);
  const router = useRouter();

  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    getQuiz(courseId)
      .then((data) => {
        if (!cancelled) setQuiz(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isAxiosError(err) && err.response?.status === 401) {
          router.push(`/login?next=/courses/${courseId}/quiz`);
          return;
        }
        if (isAxiosError(err) && err.response?.status === 403) {
          setError("수강 등록이 필요합니다.");
          return;
        }
        setError("퀴즈를 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, router]);

  const allAnswered = useMemo(
    () => quiz != null && quiz.questions.every((q) => answers[q.id] != null),
    [quiz, answers],
  );

  async function handleSubmit() {
    if (!quiz || !allAnswered) return;
    setSubmitting(true);
    try {
      const res = await submitQuiz(courseId, answers);
      setResult(res);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      alert(detail ?? "제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetry() {
    setResult(null);
    setAnswers({});
    setCurrentIdx(0);
  }

  if (error) {
    return <p className="py-20 text-center text-sm text-red-600">{error}</p>;
  }
  if (!quiz) {
    return <p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>;
  }

  if (result) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-8 text-center shadow-sm">
          <p
            className={`font-serif text-3xl font-bold ${
              result.is_passed ? "text-[var(--color-primary)]" : "text-red-600"
            }`}
          >
            {result.is_passed ? "합격하셨습니다!" : "아쉽게도 불합격입니다."}
          </p>
          <p className="mt-4 text-sm text-zinc-600">
            점수 <span className="font-semibold">{result.score}점</span> /
            합격 기준 {result.pass_score}점
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            정답 {result.correct_count} / {result.total_count}문항
          </p>

          <div className="mt-8 flex flex-col gap-2">
            {result.is_passed ? (
              <Link
                href={`/checkout?course_id=${courseId}`}
                className="rounded bg-[var(--color-accent)] py-3 font-semibold text-white hover:bg-[var(--color-accent-hover)]"
              >
                수료증 발급하기
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleRetry}
                className="rounded bg-[var(--color-primary)] py-3 font-semibold text-white hover:bg-[var(--color-primary-hover)]"
              >
                다시 도전하기
              </button>
            )}
            <Link
              href={`/courses/${courseId}/watch`}
              className="rounded border border-[var(--color-border)] py-3 text-sm text-zinc-700 hover:border-[var(--color-primary)]"
            >
              강의로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const question = quiz.questions[currentIdx];
  const total = quiz.questions.length;
  const isLast = currentIdx === total - 1;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <p className="text-xs font-medium text-[var(--color-accent)]">
          문제 {currentIdx + 1} / {total}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full bg-[var(--color-primary)] transition-[width]"
            style={{ width: `${((currentIdx + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-white p-6 shadow-sm">
        <h2 className="font-serif text-xl font-semibold leading-relaxed text-zinc-900">
          {question.question_text}
        </h2>

        <ul className="mt-6 space-y-2">
          {question.options.map((opt) => {
            const checked = answers[question.id] === opt.id;
            return (
              <li key={opt.id}>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded border px-4 py-3 text-sm transition-colors ${
                    checked
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                      : "border-[var(--color-border)] hover:border-[var(--color-primary)]/50"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    value={opt.id}
                    checked={checked}
                    onChange={() =>
                      setAnswers((prev) => ({ ...prev, [question.id]: opt.id }))
                    }
                    className="mt-0.5 accent-[var(--color-primary)]"
                  />
                  <span className="text-zinc-800">{opt.option_text}</span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 flex justify-between gap-2">
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
              disabled={!allAnswered || submitting}
              className="rounded bg-[var(--color-primary)] px-6 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
            >
              {submitting ? "채점 중..." : "제출하기"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
              disabled={answers[question.id] == null}
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
