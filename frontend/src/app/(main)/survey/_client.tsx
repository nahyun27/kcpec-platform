"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { submitSurvey, tokenStorage } from "@/lib/api";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

type Question = {
  /** 백엔드 responses dict 의 key (Claude 프롬프트와 동일해야 함) */
  key: string;
  /** 화면 라벨 */
  label: string;
  placeholder?: string;
  required: boolean;
};

const QUESTIONS: Question[] = [
  {
    key: "인적사항",
    label: "인적사항",
    placeholder:
      "성별/나이/직업/학력/가족관계/전과유무/기타(병역, 건강상태 등)",
    required: true,
  },
  {
    key: "사건내용",
    label: "이 사건의 내용",
    placeholder: "각 사건별 일시/장소/구체적인 내용을 작성해주세요",
    required: true,
  },
  {
    key: "후회되는점",
    label: "이 사건에서 가장 후회되는 점",
    required: true,
  },
  {
    key: "걱정되는점",
    label: "이 사건으로 인해 가장 걱정되는 점",
    required: true,
  },
  {
    key: "재범방지노력",
    label: "추후 재범하지 않기 위해 스스로 노력해야 하는 점",
    required: true,
  },
  {
    key: "하고싶은말",
    label: "더 하고 싶은 말 (선택사항)",
    required: false,
  },
];

export default function SurveyClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 패키지 주문(order_id) 또는 심리상담 독립 주문(counseling_order_id) 둘 다 허용.
  const orderIdParam =
    searchParams.get("order_id") ?? searchParams.get("counseling_order_id");
  const orderId = orderIdParam ? Number(orderIdParam) : NaN;
  const isCounseling = searchParams.get("counseling_order_id") != null;

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
      const next = isCounseling
        ? `/survey?counseling_order_id=${orderId}`
        : `/survey?order_id=${orderId}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
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

  function isMissingRequired(): boolean {
    return QUESTIONS.some((q, i) => q.required && !answers[i].trim());
  }

  async function handleSubmit() {
    if (isMissingRequired()) {
      setError("필수 문항(선택사항 제외)에 모두 답변해 주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const responses: Record<string, string> = {};
      QUESTIONS.forEach((q, i) => {
        const v = answers[i].trim();
        if (q.required || v.length > 0) {
          responses[q.key] = v;
        }
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
          <p className="mt-2 text-xs text-zinc-500">
            진행 상황은 마이페이지에서 확인하실 수 있습니다.
          </p>
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
  const current = QUESTIONS[currentIdx];
  const currentValue = answers[currentIdx];
  const canAdvance = current.required ? currentValue.trim().length > 0 : true;

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-16">
      <PageHeader
        title="심리상담 설문"
        subtitle="Counseling Survey"
        icon={<FileText className="h-3.5 w-3.5" />}
        description="전문 심리상담사가 분석할 수 있도록 가능한 한 구체적이고 솔직하게 답변해 주세요."
        centered
      />

      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--color-accent)]">
          문항 {currentIdx + 1} / {total}
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full bg-[var(--color-primary)] transition-[width]"
            style={{ width: `${((currentIdx + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-white p-6 shadow-sm">
        <h2 className="font-sans text-xl font-semibold leading-relaxed text-zinc-900">
          {current.label}
        </h2>

        <textarea
          value={currentValue}
          onChange={(e) => update(currentIdx, e.target.value)}
          rows={7}
          maxLength={2000}
          placeholder={current.placeholder ?? "가능한 한 솔직하고 구체적으로 적어주세요."}
          className="mt-4 min-h-[120px] w-full resize-y rounded border border-[var(--color-border)] px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-zinc-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
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
              disabled={submitting || isMissingRequired()}
              className="rounded bg-[var(--color-primary)] px-6 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
            >
              {submitting ? "제출 중..." : "제출하기"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
              disabled={!canAdvance}
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
