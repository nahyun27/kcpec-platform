import Link from "next/link";
import { CheckCircle2, Scale } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "변호사 사무실 소개 | KCPEC",
  description: "담당 변호사 사무실 소개로 오신 의뢰인을 위한 10% 할인 안내",
};

const STEPS = [
  {
    n: "01",
    title: "사건 유형 선택",
    desc: "'맞춤 강의 찾기'에서 해당 사건 유형을 선택하시면 필요한 교육과 발급 서류를 자동으로 안내해 드립니다.",
  },
  {
    n: "02",
    title: "추천 과정 결제",
    desc: "추천 교육과 발급 서류, 총 금액을 확인하고 결제합니다. 결제 화면에서 안내받은 추천 코드를 입력하시면 10% 할인이 자동으로 적용됩니다.",
  },
  {
    n: "03",
    title: "수강 후 즉시 발급",
    desc: "온라인으로 수강을 마치면 수료증 등 서류가 즉시 PDF로 발급됩니다. 24시간 언제든 가능합니다.",
  },
];

const DOCUMENTS = [
  "교육 수료증 + 서약서 (법원·검찰·경찰 제출용)",
  "전문가 심리상담 의견서 (서면 77,000원)",
  "자기성찰 리포트 · 교육이수 소감문",
  "재범방지 자가진단 검사지 · 양형자료 가이드북",
  "반성문 · 탄원서 작성 지원 (각 10,000원)",
  "교육 과정별 22,000원 ~ 55,000원",
];

const FAQS = [
  {
    q: "언제 받을 수 있나요?",
    a: "수강을 마치는 즉시 PDF로 발급됩니다. 밤이나 주말에도 가능합니다.",
  },
  {
    q: "어디에 제출하나요?",
    a: "법원·검찰·경찰 제출용으로 발급되며, 제출 방법은 담당 변호사님과 상의해 주세요.",
  },
  {
    q: "어떤 과정을 들어야 하나요?",
    a: "사건 유형만 선택하면 필요한 과정이 자동 추천됩니다.",
  },
  {
    q: "문의는 어디로 하나요?",
    a: "010-6377-3325 · admin@kcpec.co.kr",
  },
];

export default function PartnerPage() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="bg-white pt-10 md:pt-16 relative z-10 border-b border-slate-100">
        <div className="mx-auto max-w-4xl px-6">
          <PageHeader
            title="재범방지교육·양형자료, 온라인으로 한 번에 준비하세요"
            subtitle="Lawyer Referral"
            icon={<Scale className="h-3.5 w-3.5" />}
            description="담당 변호사 사무실에서 추천드리는 교육기관입니다. 사건 유형만 선택하시면 필요한 교육과 제출 서류를 자동으로 안내해 드립니다."
          />
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-12 px-6 pb-24 pt-8 md:pt-12">
        <section className="rounded-3xl border-2 border-[var(--color-primary)] bg-gradient-to-br from-blue-50 to-indigo-50 p-6 text-center shadow-sm sm:p-10">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-white">
            Lawyer Referral
          </p>
          <h2 className="mt-4 font-sans text-2xl font-black text-slate-900 sm:text-3xl">
            변호사님 소개로 오신 의뢰인 <span className="text-[var(--color-primary)]">10% 할인</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
            담당 변호사 사무실로부터 안내받은 추천 코드를 결제 화면에서 입력하시면 할인이
            자동으로 적용됩니다.
          </p>
          <Link
            href="/sentencing"
            className="mt-6 inline-flex items-center rounded-full bg-[var(--color-primary)] px-7 py-3 text-sm font-bold text-white shadow-md hover:bg-[var(--color-primary-hover)]"
          >
            맞춤 강의 찾기 시작하기 →
          </Link>
        </section>

        <section className="space-y-5">
          <h2 className="font-sans text-xl font-bold text-[var(--color-primary)] sm:text-2xl">
            이용 방법
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <span className="font-sans text-2xl font-bold text-[var(--color-accent)]">
                  {s.n}
                </span>
                <h3 className="mt-2 font-sans text-base font-bold text-slate-900">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="font-sans text-xl font-bold text-[var(--color-primary)] sm:text-2xl">
            발급 서류
          </h2>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {DOCUMENTS.map((d) => (
                <li key={d} className="flex items-start gap-2 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
                  {d}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-500">
              ※ 과정 구성과 금액은 사건에 따라 다르며, 결제 전 화면에서 총 금액을 확인하실 수
              있습니다.
            </p>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="font-sans text-xl font-bold text-[var(--color-primary)] sm:text-2xl">
            자주 묻는 질문
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FAQS.map((f) => (
              <div key={f.q} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <p className="font-semibold text-slate-900">{f.q}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-2xl border border-[var(--color-accent)]/30 bg-blue-50/50 p-6 text-center shadow-sm">
          <p className="text-sm text-slate-700">사건 유형을 선택하고 맞춤 교육과 서류를 바로 확인해 보세요.</p>
          <Link
            href="/sentencing"
            className="mt-3 inline-block rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
          >
            맞춤 강의 찾기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
