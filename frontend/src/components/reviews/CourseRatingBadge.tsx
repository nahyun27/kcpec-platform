"use client";

import { Stars } from "./Stars";
import { MIN_REVIEWS_TO_SHOW, formatAverage, useReviewSummary } from "./reviewSummary";

// 강의 카드 안 작은 별점 줄(그 강의 후기가 충분할 때만). 서버 컴포넌트 페이지에서도 쓸 수 있게 분리.
export function CourseRatingBadge({ courseId }: { courseId: number }) {
  const summary = useReviewSummary();
  const stat = summary?.courses.find((x) => x.course_id === courseId);
  if (!stat || stat.count < MIN_REVIEWS_TO_SHOW) return null;
  return (
    <span className="mt-2 flex items-center gap-1.5 text-[12.5px] text-slate-500">
      <Stars value={stat.average} className="h-3.5 w-3.5" />
      <span className="font-bold text-slate-700">{formatAverage(stat.average)}</span>
      <span>후기 {stat.count.toLocaleString()}개</span>
    </span>
  );
}
