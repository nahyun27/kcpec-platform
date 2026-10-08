"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScrollText } from "lucide-react";
import { getLegalLetterInfo } from "@/lib/api";
import { LEGAL_LETTER_LABEL, type LegalLetterInfo, type LegalLetterType } from "@/types/legalLetter";
import { PageHeader } from "@/components/layout/PageHeader";

const LETTER_TYPES: LegalLetterType[] = ["repentance", "petition"];

export default function LegalLettersPage() {
  const router = useRouter();
  const [letterInfo, setLetterInfo] = useState<LegalLetterInfo | null>(null);
  const [selected, setSelected] = useState<LegalLetterType[]>([]);

  useEffect(() => {
    getLegalLetterInfo()
      .then(setLetterInfo)
      .catch(() => {});
  }, []);

  function toggle(t: LegalLetterType) {
    setSelected((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  const total = selected.reduce((sum, t) => {
    if (!letterInfo) return sum;
    return sum + (t === "repentance" ? letterInfo.repentance_price : letterInfo.petition_price);
  }, 0);

  function handleNext() {
    if (selected.length === 0) return;
    router.push(`/checkout/bundle?courses=&letters=${selected.join(",")}`);
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="bg-white pt-10 md:pt-16 relative z-10 border-b border-slate-100">
        <div className="mx-auto max-w-3xl px-6">
          <PageHeader
            title="반성문·탄원서 작성"
            subtitle="Legal Letters"
            icon={<ScrollText className="h-3.5 w-3.5" />}
            description="몇 가지 질문에 답하시면 답변을 바탕으로 작성해 드립니다. 강의 수강 없이 반성문·탄원서만 따로 신청하실 수 있습니다."
          />
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-8 px-6 pb-24 pt-8 md:pt-12">
        <ul className="grid gap-3 sm:grid-cols-2">
          {LETTER_TYPES.map((t) => {
            const price = letterInfo
              ? t === "repentance"
                ? letterInfo.repentance_price
                : letterInfo.petition_price
              : null;
            const checked = selected.includes(t);
            return (
              <li key={t}>
                <label
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 px-5 py-4 text-sm transition-colors ${
                    checked
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                      : "border-zinc-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(t)}
                      className="h-4 w-4"
                    />
                    <span className="font-semibold text-slate-800">
                      {LEGAL_LETTER_LABEL[t]} 작성
                    </span>
                  </span>
                  <span className="shrink-0 font-bold text-slate-600">
                    {price != null ? `${price.toLocaleString()}원` : "불러오는 중..."}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">총 결제 금액</span>
            <span className="font-sans text-2xl font-black text-[var(--color-primary)]">
              {total.toLocaleString()}
              <span className="ml-1 text-sm font-bold text-slate-500">원</span>
            </span>
          </div>
          <button
            type="button"
            onClick={handleNext}
            disabled={selected.length === 0}
            className="mt-4 w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-40"
          >
            {selected.length === 0 ? "작성할 문서를 선택해 주세요" : "결제하러 가기"}
          </button>
        </div>
      </div>
    </div>
  );
}
