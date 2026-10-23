"use client";

import { useCallback, useEffect, useState } from "react";
import { getReviews } from "@/lib/api";
import type { ReviewItem } from "@/types/community";
import { ReviewSheet } from "./ReviewSheet";
import { Stars } from "./Stars";
import { formatAverage, formatReviewDate, pickCourseStat, useReviewSummary } from "./reviewSummary";

// 강의 페이지 제목 아래 별점 줄 + 최근 후기 한 줄. 강의 자체 후기가 적으면
// 같은 분야 후기 기준으로 보여주고, 그것도 적으면 아예 숨긴다.
export function CourseRating({ courseId, category }: { courseId: number; category: string }) {
  const summary = useReviewSummary();
  const [open, setOpen] = useState(false);
  const [latest, setLatest] = useState<ReviewItem | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const picked = summary ? pickCourseStat(summary, courseId, category) : null;
  const scope = picked?.scope;

  useEffect(() => {
    if (!scope) return;
    let alive = true;
    getReviews(scope === "course" ? { course_id: courseId, size: 1 } : { category, size: 1 })
      .then((res) => alive && setLatest(res.items[0] ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [scope, courseId, category]);

  if (!summary || !picked) return null;
  const { stat } = picked;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full max-w-xl rounded-xl text-left transition-opacity hover:opacity-80"
      >
        <span className="flex flex-wrap items-center gap-2">
          <Stars value={stat.average} className="h-4 w-4" />
          <span className="font-bold text-slate-900">{formatAverage(stat.average)}</span>
          <span className="text-sm text-slate-500">
            {scope === "course" ? "이 강의" : `${category} 분야`} 후기 {stat.count.toLocaleString()}개 ›
          </span>
        </span>
        {latest ? (
          <span className="mt-1.5 block truncate text-sm text-slate-600">
            &ldquo;{latest.content}&rdquo;{" "}
            <span className="text-slate-400">· {formatReviewDate(latest.created_at)}</span>
          </span>
        ) : null}
      </button>
      {open ? (
        <ReviewSheet summary={summary} initialCategory={category} onClose={close} />
      ) : null}
    </>
  );
}
