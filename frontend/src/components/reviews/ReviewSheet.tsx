"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { getReviews } from "@/lib/api";
import type { ReviewItem, ReviewSummary } from "@/types/community";
import { Spinner } from "@/components/ui/Spinner";
import { Stars } from "./Stars";
import { formatAverage, formatReviewDate } from "./reviewSummary";

const PAGE_SIZE = 10;

// 후기 창 — 모바일은 아래에서 올라오는 시트, PC는 가운데 창. 고객이 별점
// 배지를 눌렀을 때만 열린다(자동 팝업 없음).
export function ReviewSheet({
  summary,
  initialCategory = null,
  onClose,
}: {
  summary: ReviewSummary;
  initialCategory?: string | null;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let alive = true;
    getReviews({ category, page: 1, size: PAGE_SIZE })
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
        setTotal(res.total);
        setPage(1);
      })
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [category]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function selectCategory(next: string | null) {
    if (next === category) return;
    setItems(null);
    setCategory(next);
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await getReviews({ category, page: page + 1, size: PAGE_SIZE });
      setItems((prev) => [...(prev ?? []), ...res.items]);
      setPage(page + 1);
    } finally {
      setLoadingMore(false);
    }
  }

  const maxBar = Math.max(1, summary.count);

  // 히어로 등 부모의 z-index/overflow 에 갇히지 않게 body 로 띄운다(헤더·
  // 다음 섹션이 창을 덮던 문제).
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 md:items-center md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="수강생 후기"
    >
      <div
        className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white text-left shadow-2xl animate-in slide-in-from-bottom-8 duration-300 md:max-w-xl md:rounded-2xl md:fade-in md:slide-in-from-bottom-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 px-5 pt-3 md:px-7 md:pt-6">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 md:hidden" />
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="absolute right-4 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:top-5"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-5">
            <div className="shrink-0">
              <p className="font-sans text-4xl font-black leading-none text-slate-900">
                {formatAverage(summary.average)}
              </p>
              <div className="mt-2">
                <Stars value={summary.average} className="h-4 w-4" />
              </div>
              <p className="mt-1 text-xs text-slate-500">후기 {summary.count.toLocaleString()}개</p>
            </div>
            <ul className="min-w-0 flex-1 space-y-1 pr-8">
              {["5", "4", "3", "2", "1"].map((k) => {
                const n = summary.distribution[k] ?? 0;
                return (
                  <li key={k} className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="w-6 shrink-0">{k}점</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full bg-amber-400"
                        style={{ width: `${(n / maxBar) * 100}%` }}
                      />
                    </span>
                    <span className="w-7 shrink-0 text-right tabular-nums">{n}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-3 md:-mx-7 md:px-7">
            {[{ key: null as string | null, label: "전체", count: summary.count }]
              .concat(summary.categories.map((c) => ({ key: c.key, label: c.key, count: c.count })))
              .map((chip) => {
                const active = chip.key === category;
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => selectCategory(chip.key)}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                    }`}
                  >
                    {chip.label} <span className={active ? "text-white/70" : "text-slate-400"}>{chip.count}</span>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-100 px-5 md:px-7">
          {items == null ? (
            <div className="flex justify-center py-12">
              <Spinner size="sm" tone="accent" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">아직 등록된 후기가 없습니다.</p>
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {items.map((r) => (
                  <li key={r.id} className="py-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">
                        익명 수강생 · {formatReviewDate(r.created_at)}
                      </span>
                      {r.category ? (
                        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[var(--color-accent)]">
                          {r.category}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex items-start gap-2">
                      <span className="mt-0.5 shrink-0">
                        <Stars value={r.rating} className="h-3.5 w-3.5" />
                      </span>
                      {r.content ? (
                        <p className="min-w-0 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                          {r.content}
                        </p>
                      ) : null}
                    </div>
                    {r.course_title ? (
                      <p className="mt-1 text-[11px] text-slate-400">{r.course_title} 수강</p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {items.length < total ? (
                <div className="pb-6 pt-2">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="w-full rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:border-slate-400 disabled:opacity-60"
                  >
                    {loadingMore ? "불러오는 중..." : `후기 더 보기 (${items.length}/${total})`}
                  </button>
                </div>
              ) : (
                <div className="pb-6" />
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
