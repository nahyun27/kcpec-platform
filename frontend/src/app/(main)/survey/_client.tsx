"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import {
  getMySurvey,
  submitSurvey,
  tokenStorage,
  updateMySurvey,
} from "@/lib/api";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

type Question = {
  /** 백엔드 responses dict 의 key (Claude 프롬프트와 동일해야 함) */
  key: string;
  /** 화면 라벨 */
  label: string;
  /** 라벨 아래 회색으로 노출되는 작성 가이드 */
  description: string;
  /** textarea 내부에 보일 짧은 예시 */
  placeholder: string;
  required: boolean;
};

const QUESTIONS: Question[] = [
  {
    key: "인적사항",
    label: "인적사항",
    description:
      "성별, 나이, 직업, 학력, 가족관계, 전과유무, 기타(병역, 건강상태 등)를 작성해 주세요.",
    placeholder: "예) 35세 남성, 직장인, 배우자와 자녀 2명, 군필, 별다른 지병 없음",
    required: true,
  },
  {
    key: "사건내용",
    label: "이 사건의 내용",
    description:
      "각 사건별로 일시, 장소, 구체적인 경위를 시간 순서대로 작성해 주세요.",
    placeholder:
      "예) 2025년 8월 어느 토요일 밤, 서울 강남구. 회식 후 음주 상태에서...",
    required: true,
  },
  {
    key: "후회되는점",
    label: "이 사건에서 가장 후회되는 점",
    description:
      "사건 당시 본인의 판단·행동 중 지금 돌이켜 가장 후회되는 부분을 솔직하게 적어 주세요.",
    placeholder:
      "예) 술자리를 거절하지 못하고 결국 직접 차에 탔던 점이 가장 후회됩니다.",
    required: true,
  },
  {
    key: "걱정되는점",
    label: "이 사건으로 인해 가장 걱정되는 점",
    description:
      "법적·경제적·관계적·심리적 측면에서 지금 가장 우려되는 부분을 적어 주세요.",
    placeholder:
      "예) 가족이 받게 될 정신적 부담, 직장 내 평판과 향후 경력에 미칠 영향이...",
    required: true,
  },
  {
    key: "재범방지노력",
    label: "추후 재범하지 않기 위해 스스로 노력해야 하는 점",
    description:
      "구체적인 행동 계획이나 환경 변화 등 본인이 실천할 수 있는 다짐을 적어 주세요.",
    placeholder:
      "예) 회식 자리는 1차에서 정리, 음주 시 무조건 대중교통 이용, 매주 ...",
    required: true,
  },
  {
    key: "하고싶은말",
    label: "더 하고 싶은 말 (선택사항)",
    description:
      "위 항목 외에 상담사에게 미리 전달하고 싶은 내용이 있다면 자유롭게 적어 주세요.",
    placeholder:
      "예) 현재 정신과 약물 복용 중이며, 사건 이후 불면 증상이 있습니다.",
    required: false,
  },
];

export default function SurveyClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 신규 작성: ?order_id= 또는 ?counseling_order_id=
  // 수정: ?edit={survey_id} (기존 응답 prefill + PUT)
  const editParam = searchParams.get("edit");
  const editSurveyId = editParam ? Number(editParam) : null;
  const isEditMode = editSurveyId != null && Number.isFinite(editSurveyId);

  const orderIdParam =
    searchParams.get("order_id") ?? searchParams.get("counseling_order_id");
  const orderId = orderIdParam ? Number(orderIdParam) : NaN;
  const isCounseling = searchParams.get("counseling_order_id") != null;

  const [answers, setAnswers] = useState<string[]>(() => QUESTIONS.map(() => ""));
  const [loadingPrefill, setLoadingPrefill] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 비로그인 → 로그인 페이지로 (edit 모드는 edit 쿼리 보존)
  useEffect(() => {
    if (tokenStorage.getAccess()) return;
    let next = "/survey";
    if (isEditMode) next = `/survey?edit=${editSurveyId}`;
    else if (isCounseling) next = `/survey?counseling_order_id=${orderId}`;
    else if (Number.isFinite(orderId)) next = `/survey?order_id=${orderId}`;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 신규 모드 진입 가드
  useEffect(() => {
    if (isEditMode) return;
    if (!Number.isFinite(orderId)) {
      setError("잘못된 접근입니다. (order_id 누락)");
    }
  }, [isEditMode, orderId]);

  // 수정 모드: 기존 응답 prefill
  useEffect(() => {
    if (!isEditMode || !tokenStorage.getAccess()) return;
    let cancelled = false;
    getMySurvey(editSurveyId!)
      .then((d) => {
        if (cancelled) return;
        const next = QUESTIONS.map((q) => d.responses[q.key] ?? "");
        setAnswers(next);
      })
      .catch(() => {
        if (!cancelled) setError("기존 설문을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoadingPrefill(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEditMode, editSurveyId]);

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
      if (isEditMode) {
        await updateMySurvey(editSurveyId!, responses);
      } else {
        await submitSurvey(orderId, responses);
      }
      setSubmitted(true);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(
        detail ??
          (isEditMode ? "설문 수정에 실패했습니다." : "설문 제출에 실패했습니다."),
      );
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
            {isEditMode ? "설문이 수정되었습니다" : "설문이 제출되었습니다"}
          </p>
          <p className="mt-3 text-sm text-zinc-700">
            {isEditMode
              ? "수정된 응답으로 의견서 초안을 다시 생성합니다. 결과는 검토 후 이메일로 전달드립니다."
              : "전문 상담사가 검토 후 24시간 이내에 이메일로 의견서를 전달드립니다."}
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

  if (loadingPrefill) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center text-sm text-zinc-500">
        기존 응답을 불러오는 중입니다...
      </div>
    );
  }

  const total = QUESTIONS.length;
  const answeredCount = QUESTIONS.reduce(
    (acc, q, i) => (q.required && answers[i].trim() ? acc + 1 : acc),
    0,
  );
  const requiredCount = QUESTIONS.filter((q) => q.required).length;
  const missing = isMissingRequired();

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-16">
      <PageHeader
        title={isEditMode ? "심리상담 설문 수정" : "심리상담 설문"}
        subtitle={isEditMode ? "Edit Survey" : "Counseling Survey"}
        icon={<FileText className="h-3.5 w-3.5" />}
        description={
          isEditMode
            ? "수정 후 제출하면 의견서 초안이 다시 생성됩니다."
            : "전문 심리상담사가 분석할 수 있도록 가능한 한 구체적이고 솔직하게 답변해 주세요."
        }
        centered
      />

      {/* 진행 상태 — 응답 완료된 필수 문항 수 기반 */}
      <div className="sticky top-16 z-10 -mx-4 rounded-none border-y border-[var(--color-border)] bg-white/85 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-600">
          <span>
            응답 완료{" "}
            <span className="font-bold text-[var(--color-primary)]">
              {answeredCount}
            </span>{" "}
            / {requiredCount} 문항
          </span>
          <span className="text-zinc-400">선택 1문항 포함, 총 {total}개</span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full bg-[var(--color-primary)] transition-[width] duration-300"
            style={{ width: `${(answeredCount / requiredCount) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-10">
        {QUESTIONS.map((q, idx) => {
          const value = answers[idx];
          return (
            <section
              key={q.key}
              className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary)]/10 font-mono text-xs font-bold tracking-wider text-[var(--color-primary)]">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <h2 className="font-sans text-base font-semibold leading-snug text-zinc-900">
                  {q.label}
                  {q.required ? (
                    <span className="ml-1.5 text-xs font-bold text-red-500">
                      *
                    </span>
                  ) : null}
                </h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                {q.description}
              </p>
              <textarea
                value={value}
                onChange={(e) => update(idx, e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder={q.placeholder}
                className="mt-3 min-h-[120px] w-full resize-y rounded border border-[var(--color-border)] px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-zinc-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
              <p className="mt-1 text-right text-xs text-zinc-400">
                {value.length} / 2000
              </p>
            </section>
          );
        })}
      </div>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || missing}
          className="w-full rounded-xl bg-[var(--color-primary)] py-4 text-base font-semibold text-white shadow-md shadow-[var(--color-primary)]/20 transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] hover:shadow-lg hover:shadow-[var(--color-primary)]/30 disabled:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {submitting
            ? isEditMode
              ? "수정 중..."
              : "제출 중..."
            : missing
              ? `필수 ${requiredCount - answeredCount}문항이 남았습니다`
              : isEditMode
                ? "수정 완료"
                : "제출하기"}
        </button>
      </div>
    </div>
  );
}
