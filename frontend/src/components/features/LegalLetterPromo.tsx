"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { getLegalLetterInfo } from "@/lib/api";

// 반성문·탄원서 홍보 카드 — 실제 신청/결제는 전문가 심리상담(/counseling)
// 결제 화면에서 이뤄진다(구매 후 AI가 답변을 바탕으로 자동 작성).
// 맞춤강의 찾기·강의 전체보기 페이지 하단에서 노출(2026-09).
export function LegalLetterPromo({ className = "" }: { className?: string }) {
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    getLegalLetterInfo()
      .then((info) => setPrice(info.repentance_price))
      .catch(() => {});
  }, []);

  return (
    <div
      className={`rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 sm:p-8 ${className}`}
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--color-primary)] shadow-sm">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="font-sans text-lg font-bold text-slate-900">
              반성문·탄원서도 AI로 간편하게 준비하세요
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              몇 가지 질문에 답하시면 AI가 답변을 바탕으로 본문을 자동으로 작성해 서식에 맞춰
              PDF로 발급해 드립니다{price ? ` (각 ${price.toLocaleString()}원)` : ""}. 전문가
              심리상담 신청 시 함께 추가할 수 있습니다.
            </p>
          </div>
        </div>
        <Link
          href="/counseling"
          className="group inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] sm:w-auto"
        >
          전문가 심리상담에서 신청하기
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
