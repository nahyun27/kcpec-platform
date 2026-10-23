"use client";

import { useEffect, useState } from "react";
import { getReviewSummary } from "@/lib/api";
import type { ReviewCourseStat, ReviewStat, ReviewSummary } from "@/types/community";

// 홈 배지·후기 창·강의 페이지가 한 화면에 여러 개 떠도 요약은 한 번만 받는다.
let cached: Promise<ReviewSummary> | null = null;

export function useReviewSummary(): ReviewSummary | null {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  useEffect(() => {
    let alive = true;
    if (!cached) {
      cached = getReviewSummary().catch((err) => {
        cached = null;
        throw err;
      });
    }
    cached.then((s) => alive && setSummary(s)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return summary;
}

// 평균은 소수 둘째 자리까지 그대로(예: 4.98). 한 자리로 반올림하면 5.0 이
// 되어 오히려 덜 믿긴다는 고객사 요청.
export function formatAverage(avg: number): string {
  return avg.toFixed(2);
}

// 후기가 너무 적으면 별점 줄이 오히려 신뢰를 떨어뜨려 숨긴다.
export const MIN_REVIEWS_TO_SHOW = 3;

// 강의 자체 후기가 충분하면 그 강의 기준, 아니면 같은 분야 기준으로 보여준다.
export function pickCourseStat(
  summary: ReviewSummary,
  courseId: number,
  category: string | null | undefined,
): { stat: ReviewCourseStat | ReviewStat; scope: "course" | "category" } | null {
  const own = summary.courses.find((c) => c.course_id === courseId);
  if (own && own.count >= MIN_REVIEWS_TO_SHOW) return { stat: own, scope: "course" };
  const cat = category ? summary.categories.find((c) => c.key === category) : undefined;
  if (cat && cat.count >= MIN_REVIEWS_TO_SHOW) return { stat: cat, scope: "category" };
  return null;
}

export function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  return d.getFullYear() === new Date().getFullYear()
    ? `${d.getMonth() + 1}/${d.getDate()}`
    : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}
