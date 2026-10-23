"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { isAxiosError } from "axios";
import { Check, Star } from "lucide-react";
import { createPost, dismissReviewPrompt, getReviewPrompt } from "@/lib/api";
import type { ReviewPromptState } from "@/types/community";

// 수료증 다운로드 직후 한 번만 묻는 후기 요청. 별점은 누르기만, 글은 선택.
// "다음에"를 누르면 다시 묻지 않는다(서버에 기록). 이미 후기를 쓴 강의,
// 구속수용자 주문, 심리상담은 서버가 show=false 로 막는다.
export function useReviewPrompt() {
  const [prompt, setPrompt] = useState<ReviewPromptState | null>(null);
  const [asked, setAsked] = useState(false);

  const maybeAsk = useCallback(
    (orderId: number) => {
      if (asked) return;
      setAsked(true);
      // 다운로드 탭이 먼저 열리도록 아주 잠깐 늦춰서 띄운다.
      getReviewPrompt(orderId)
        .then((res) => {
          if (res.show) window.setTimeout(() => setPrompt(res), 600);
        })
        .catch(() => {});
    },
    [asked],
  );

  const element = prompt ? <ReviewPromptModal prompt={prompt} onClose={() => setPrompt(null)} /> : null;
  return { maybeAsk, element };
}

function ReviewPromptModal({
  prompt,
  onClose,
}: {
  prompt: ReviewPromptState;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function later() {
    void dismissReviewPrompt().catch(() => {});
    onClose();
  }

  async function submit() {
    if (!rating || prompt.course_id == null) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPost({
        category: "review",
        title: content.trim().slice(0, 80),
        content: content.trim(),
        course_id: prompt.course_id,
        course_category: prompt.course_category ?? undefined,
        rating,
      });
      setDone(true);
      window.setTimeout(onClose, 1400);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "후기 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  const shown = hover || rating;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="수강 후기 남기기"
        className="w-full rounded-t-3xl bg-white px-6 pb-7 pt-7 text-center shadow-2xl animate-in slide-in-from-bottom-8 duration-300 sm:max-w-sm sm:rounded-2xl"
      >
        {done ? (
          <div className="py-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check className="h-6 w-6" />
            </div>
            <p className="mt-4 text-lg font-extrabold text-slate-900">소중한 후기 감사합니다!</p>
          </div>
        ) : (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              <Check className="h-3.5 w-3.5" /> 수료증 다운로드 완료
            </span>
            <h2 className="mt-3 text-xl font-extrabold text-slate-900">수료를 축하드립니다!</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              별점과 한 줄 후기를 남겨주시면
              <br />
              같은 고민을 하는 분들께 큰 도움이 됩니다.
            </p>
            {prompt.course_title ? (
              <p className="mt-1 text-xs text-slate-400">{prompt.course_title}</p>
            ) : null}

            <div className="mt-5 flex justify-center gap-1.5" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n}점`}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  className="p-0.5 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-10 w-10 ${n <= shown ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-200"}`}
                  />
                </button>
              ))}
            </div>

            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={200}
              placeholder="한 줄 후기 (선택)"
              className="mt-5 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
            <p className="mt-2 text-[11px] text-slate-400">후기는 이름 없이 익명으로 공개됩니다.</p>
            {error ? <p className="mt-2 text-xs font-semibold text-red-600">{error}</p> : null}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={later}
                disabled={submitting}
                className="h-12 rounded-xl bg-slate-100 text-sm font-bold text-slate-600 hover:bg-slate-200"
              >
                다음에
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!rating || submitting}
                className="h-12 rounded-xl bg-slate-900 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {submitting ? "등록 중..." : "후기 남기기"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
