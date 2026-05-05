"use client";

import { useMemo, useState } from "react";

type Category = "all" | "docs" | "refund" | "counseling" | "etc";

type FaqItem = {
  q: string;
  a: string;
  cat: Exclude<Category, "all">;
};

const FAQ: FaqItem[] = [
  {
    cat: "docs",
    q: "수료증 또는 상담의견서 등은 언제 어떻게 받을 수 있나요?",
    a: "수강자가 강의를 수강한 내역이 확인되면 익일 24시까지 가입하신 이메일을 통해 pdf파일로 보내드립니다.\n상담의견서는 상담 후 24시간 이내에 가입하신 이메일을 통해 pdf파일로 보내드립니다.",
  },
  {
    cat: "docs",
    q: "수료증을 재발급 받을 수 있나요?",
    a: "수료증을 재발급 받기 위해서는 법령에 따른 개인정보 보관 기간 내에 admin@kcpec.co.kr 이메일로 문의주시면 1회에 한하여 재발급해드립니다.",
  },
  {
    cat: "refund",
    q: "환불 및 취소가 가능한가요?",
    a: "결제 오류에 대한 환불이나 취소는 가능하나, 강의 수강 시작 후 또는 상담 의뢰 후 환불이나 취소는 불가합니다.",
  },
  {
    cat: "counseling",
    q: "상담 절차는 어떻게 진행되나요?",
    a: "기본 상담 절차는 이용자가 상담 설문지를 작성하여 제출하는 서면상담 방식으로 진행됩니다.\n심화상담은 의뢰를 하실 경우 상담사와 일정을 맞춘 후 상담사가 해당 시간에 이용자에게 전화를 드리거나 대면상담을 진행합니다.\n모든 상담이 종료된 후 24시간 이내에 상담의견서 등을 pdf파일로 가입하신 이메일로 보내드립니다.",
  },
  {
    cat: "docs",
    q: "발급받은 서류를 법원이나 수사기관에 제출해도 되나요?",
    a: "네, 저희 센터에서 발급한 수료증, 상담 의견서, 서약서 등 자료는 법원이나 수사기관, 학교 등 공공기관에 제출하셔도 됩니다.",
  },
  {
    cat: "etc",
    q: "양형자료만 내면 무조건 감형이 되는 건가요?",
    a: "그렇지 않습니다. 검찰이나 법원의 양형판단은 다양한 요소들을 바탕으로 종합적으로 이루어지기 때문입니다.\n다만 수료증, 상담 의견서 등 양형자료는 재범예방교육 또는 심리상담을 통해 피고인(또는 피의자)이 재범하지 않을 것을 굳게 다짐하고 있다는 사정을 경찰, 검찰이나 법원에 알리는 효과적인 방법이 될 수 있습니다.",
  },
  {
    cat: "docs",
    q: "발급받은 서류의 진위 확인이 가능한가요?",
    a: "네 가능합니다. 저희 센터에서 발급하는 서류는 워터마크가 삽입되어 있으며 문서일련번호로 진위 확인이 가능합니다.\n서류의 진위확인을 원하시는 경우, 서류 사본과 문의하실 내용을 적어 admin@kcpec.co.kr로 이메일 문의를 주시면 답변드립니다.",
  },
  {
    cat: "etc",
    q: "사건에 대한 변호사 상담을 받을 수 있나요?",
    a: "본 센터는 변호사 소개나 알선, 상담을 제공하지 않습니다.",
  },
];

const TABS: { key: Category; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "docs", label: "수료증·서류" },
  { key: "refund", label: "환불·취소" },
  { key: "counseling", label: "상담" },
  { key: "etc", label: "기타" },
];

import { HelpCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export default function FaqPage() {
  const [tab, setTab] = useState<Category>("all");
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const visible = useMemo(
    () => (tab === "all" ? FAQ : FAQ.filter((it) => it.cat === tab)),
    [tab],
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 pb-24">
      <PageHeader
        title="자주 묻는 질문"
        subtitle="FAQ"
        icon={<HelpCircle className="h-3.5 w-3.5" />}
      />

      <div className="mt-8 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setOpenIdx(0);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === t.key
                ? "bg-[var(--color-primary)] text-white"
                : "border border-zinc-200 bg-white text-slate-600 hover:border-[var(--color-primary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-zinc-300 bg-white py-12 text-center text-sm text-zinc-500">
          해당 카테고리의 질문이 아직 없습니다.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {visible.map((item, idx) => {
            const open = openIdx === idx;
            return (
              <li
                key={item.q}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : idx)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <span className="font-sans text-sm font-semibold text-slate-900 sm:text-base">
                    Q. {item.q}
                  </span>
                  <span
                    className={`text-sm text-[var(--color-primary)] transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {open ? (
                  <div className="whitespace-pre-line border-t border-zinc-200 bg-slate-50/50 px-5 py-4 text-sm leading-relaxed text-slate-700">
                    A. {item.a}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
