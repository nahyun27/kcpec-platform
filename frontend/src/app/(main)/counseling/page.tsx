import Link from "next/link";
import ApplyButton from "./ApplyButton";
import type { CounselingType } from "@/types/counseling";

export const metadata = {
  title: "전문가 심리상담 | KCPEC",
  description: "전문 심리상담사가 진행하는 범죄심리·정신분석 상담 프로그램",
};

const CERTIFICATES = [
  { title: "인지행동심리상담사 1급", issuer: "한국자격검정진흥원" },
  { title: "심리상담사 1급", issuer: "한국자격검정평가진흥원" },
  { title: "중독심리상담사", issuer: "한국복지상담심리협회" },
  { title: "학교폭력예방상담사 1급", issuer: "한국자격검정평가진흥원" },
];

const PROGRAMS: {
  name: string;
  type: CounselingType;
  price: number | null;
  composition: string;
  goals: string[];
  session: string[];
  highlight?: boolean;
}[] = [
  {
    name: "기본 프로그램",
    type: "basic",
    price: 143_000,
    composition: "범죄심리상담",
    goals: [
      "내담자 개인 경험 분석을 통한 범죄심리 분석",
      "내담자 맞춤형 재범 방지 솔루션의 확립",
    ],
    session: ["서면질의상담", "비대면", "비용 143,000원"],
  },
  {
    name: "전화 심화상담",
    type: "phone",
    price: null,
    composition: "범죄심리상담 + 정신분석상담",
    goals: [
      "'무의식의 의식화'를 통한 내담자의 완전한 자기객관화",
      "자아의 통제 하에서 발생하는 정신적 어려움을 해결하고 다양한 신경증적인 증상을 해결",
    ],
    session: ["4회 과정", "비대면", "비용 별도문의"],
    highlight: true,
  },
  {
    name: "대면 심화상담",
    type: "inperson",
    price: null,
    composition: "범죄심리상담 + 정신분석상담 + 합리적 정서행동치료",
    goals: [
      "내담자의 긍정적 변화를 위한 내면적 동기와 잠재력의 확인",
      "스스로 변화를 모색하고 문제를 해결할 수 있는 능력의 함양",
      "단순 이슈해결을 넘어 내담자 인생 전반의 삶의 방향성 확립",
    ],
    session: ["8회 과정", "대면(비대면 불가)", "비용 별도문의"],
  },
];

export default function CounselingPage() {
  return (
    <div className="bg-white pb-24">
      {/* 1) Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0f1d3a] via-[var(--color-primary)] to-[#2A4B8D] py-24 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--color-accent)]">
            Professional Counseling
          </p>
          <h1 className="mt-4 font-sans text-4xl font-extrabold tracking-tight sm:text-5xl">
            전문가 심리상담
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-200 sm:text-lg">
            범죄심리 분석부터 정신분석·행동치료까지,
            <br className="hidden sm:inline" />
            내담자 맞춤형 재범 방지 솔루션을 제공합니다.
          </p>
        </div>
      </section>

      {/* 2) Intro */}
      <section className="relative overflow-hidden bg-slate-50 py-24 sm:py-32">
        <div className="relative z-10 mx-auto max-w-4xl px-6">
          <div className="rounded-[2rem] border border-zinc-100 bg-white p-10 text-center shadow-2xl shadow-slate-200/50 sm:p-16">
            <div className="mx-auto mb-10 h-1.5 w-16 rounded-full bg-[var(--color-accent)]"></div>
            <div className="space-y-8 text-base leading-relaxed text-slate-700 sm:text-lg md:text-xl md:leading-loose">
              <p>
                심리상담은 내담자의 개인적인 경험을 토대로 <br className="hidden sm:inline" />
                <strong className="font-bold text-slate-900">전문심리상담사가 내담자의 심리적 원인을 진단하고 치유</strong>하는 것을 목표로 합니다.
              </p>
              <p>
                저희 센터의 상담 전문가들은 내담자와의 면담을 통해 내담자들이 범죄를
                저지르게 된 심리적인 원인을 진단합니다.<br className="hidden md:inline" /> 그리고 이러한 심리적 원인을
                치유함으로써 내담자들이 <strong className="font-bold text-[var(--color-primary)]">추후 재범을 하지 않도록 도움</strong>을 줍니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3) Certificates */}
      <section className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <header className="mb-10 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]">
              Qualifications
            </p>
            <h2 className="mt-3 font-sans text-3xl font-extrabold tracking-tight text-[var(--color-primary)]">
              보유 자격증
            </h2>
          </header>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CERTIFICATES.map((c) => (
              <div
                key={c.title}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-transform hover:-translate-y-1"
              >
                {/* 자격증 이미지 자리 — 추후 실제 이미지로 교체 */}
                <div className="flex aspect-[3/4] items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
                  <div className="text-center">
                    <p className="font-sans text-2xl font-bold tracking-widest text-slate-300">
                      KCPEC
                    </p>
                    <p className="mt-2 text-[10px] uppercase tracking-widest text-slate-400">
                      Certificate
                    </p>
                  </div>
                </div>
                <div className="space-y-1 p-4 text-center">
                  <p className="font-sans text-sm font-bold leading-snug text-slate-900">
                    {c.title}
                  </p>
                  <p className="text-xs text-slate-500">{c.issuer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4) Programs */}
      <section className="bg-slate-50 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <header className="mb-10 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]">
              Programs
            </p>
            <h2 className="mt-3 font-sans text-3xl font-extrabold tracking-tight text-[var(--color-primary)]">
              전문가 심리상담 프로그램
            </h2>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {PROGRAMS.map((p) => (
              <article
                key={p.name}
                className={`flex flex-col overflow-hidden rounded-3xl bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  p.highlight
                    ? "ring-2 ring-[var(--color-primary)] shadow-[var(--color-primary)]/10"
                    : "border border-zinc-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-sans text-xl font-bold text-[var(--color-primary)]">
                    {p.name}
                  </h3>
                  {p.highlight ? (
                    <span className="rounded-full bg-[var(--color-accent)]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
                      추천
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-500">구성</p>
                <p className="text-sm font-semibold text-slate-800">
                  {p.composition}
                </p>

                <div className="mt-6 space-y-2">
                  <p className="text-xs text-slate-500">목적</p>
                  <ul className="space-y-1.5 text-sm leading-relaxed text-slate-700">
                    {p.goals.map((g) => (
                      <li key={g} className="flex gap-2">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent)]" />
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 border-t border-zinc-100 pt-4">
                  <p className="text-xs text-slate-500">세션 및 진행방법</p>
                  <ul className="mt-2 space-y-1 text-sm font-medium text-slate-800">
                    {p.session.map((s) => (
                      <li key={s}>· {s}</li>
                    ))}
                  </ul>
                </div>

                <ApplyButton counselingType={p.type} price={p.price} />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[var(--color-primary)] py-12 text-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-6 px-6 text-center sm:flex-row sm:text-left">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]">
              Contact
            </p>
            <p className="mt-2 font-sans text-xl font-bold">
              심리상담 의뢰 및 문의는 아래 연락처로 부탁드립니다.
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 sm:items-end">
            <a
              href="tel:01063773325"
              className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-[var(--color-accent-hover)]"
            >
              상담 문의: 010-6377-3325
            </a>
            <Link
              href="mailto:admin@kcpec.co.kr"
              className="text-sm text-white/80 hover:text-white"
            >
              이메일: admin@kcpec.co.kr
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
