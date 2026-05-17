import Image from "next/image";
import Link from "next/link";
import ApplyButton from "./ApplyButton";
import type { CounselingType } from "@/types/counseling";
import { CheckCircle2, FileSignature, ShieldCheck, Award } from "lucide-react";

export const metadata = {
  title: "전문가 심리상담 | KCPEC",
  description: "전문 심리상담사가 진행하는 범죄심리·정신분석 상담 프로그램",
};

const CERTIFICATES: { slug: string; title: string; issuer: string }[] = [
  {
    slug: "cognitive_counselor_1st",
    title: "인지행동심리상담사 1급",
    issuer: "한국자격검정진흥원",
  },
  {
    slug: "counselor_1st",
    title: "심리상담사 1급",
    issuer: "한국자격검정평가진흥원",
  },
  {
    slug: "addiction_counselor",
    title: "중독심리상담사",
    issuer: "한국복지상담심리협회",
  },
  {
    slug: "school_violence_counselor_1st",
    title: "학교폭력예방상담사 1급",
    issuer: "한국자격검정평가진흥원",
  },
  {
    slug: "crime_counselor",
    title: "범죄심리상담사",
    issuer: "한국자격검정평가진흥원",
  },
];

// 심리상담은 alembic 0017 부터 단일 상품(기본 프로그램) 으로 운영.
// 전화/대면 심화상담은 비활성화 (기존 주문 데이터는 그대로 유지).
// 가격은 backend courses.price (id=12) 와 동기화 필요 — TODO: 클라이언트
// 확정가 변경 시 함께 갱신.
const COUNSELING_PRODUCT: {
  type: CounselingType;
  price: number;
  composition: string;
  goals: string[];
  process: string[];
} = {
  type: "basic",
  price: 143_000,
  composition: "범죄심리상담",
  goals: [
    "내담자 개인 경험 분석을 통한 범죄심리 분석",
    "내담자 맞춤형 재범 방지 솔루션 확립",
    "법원 제출용 의견서 작성을 위한 심리 평가 및 정리",
  ],
  process: [
    "온라인 설문지 작성",
    "전문 심리상담사 검토",
    "AI 초안 + 전문가 검수",
    "심리상담 의견서 PDF 발급 (1~2 영업일)",
  ],
};

export default function CounselingPage() {
  return (
    <div className="bg-white">
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

      {/* 2) Expert Intro & Qualifications (Merged) */}
      <section className="relative overflow-hidden bg-white py-24 sm:py-32">
        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-center">
            
            {/* Text Description */}
            <div className="flex flex-col justify-center">
              <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--color-primary)] ring-1 ring-inset ring-blue-500/20">
                <ShieldCheck className="h-4 w-4" />
                Certified Experts
              </div>
              <h2 className="font-sans text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                공인된 1급 심리상담사의<br />
                <span className="text-[var(--color-primary)]">전문적이고 확실한 치유</span>
              </h2>
              <div className="mt-8 space-y-6 text-base leading-relaxed text-slate-600 sm:text-lg sm:leading-loose">
                <p>
                  단순한 면담을 넘어, 내담자가 범죄에 이르게 된 <strong className="text-slate-900 font-bold underline decoration-blue-200 decoration-4 underline-offset-4">근본적인 심리적 원인을 정밀하게 진단</strong>합니다.
                </p>
                <p>
                  KCPEC의 모든 상담은 국가 및 공인 기관에서 엄격하게 검증받은 <strong>최고 수준의 1급 전문 심리상담사</strong>가 직접 진행하며, 내담자의 완전한 자기객관화와 성공적인 사회 복귀를 돕습니다.
                </p>
              </div>
            </div>

            {/* Certificates Grid */}
            <div className="rounded-3xl bg-slate-50 p-8 sm:p-12 ring-1 ring-inset ring-slate-200/60 shadow-sm">
              <div className="flex items-center gap-2 mb-8">
                <Award className="h-5 w-5 text-[var(--color-accent)]" />
                <h3 className="text-lg font-bold text-slate-900">상담사 보유 자격 및 면허</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {CERTIFICATES.map((c) => (
                  <a
                    key={c.slug}
                    href={`/certs/${c.slug}.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${c.title} 원본 보기`}
                    className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-[var(--color-primary)]/40 hover:shadow-lg"
                  >
                    <div className="relative mb-3 h-20 w-16 overflow-hidden rounded shadow-sm sm:h-24 sm:w-20">
                      <Image
                        src={`/certs/${c.slug}.jpg`}
                        alt={`${c.title} 자격증`}
                        fill
                        sizes="80px"
                        quality={80}
                        className="object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    </div>
                    <p className="font-sans text-[13px] font-extrabold leading-tight text-slate-900 sm:text-sm">
                      {c.title}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-slate-500 sm:text-xs">{c.issuer}</p>
                  </a>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3) 단일 상품 — 심리상담 의견서 */}
      <section className="bg-slate-50 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <header className="mb-10 text-center sm:mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]">
              Product
            </p>
            <h2 className="mt-3 font-sans text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              심리상담 의견서
            </h2>
            <p className="mt-4 text-[15px] text-slate-500 sm:text-lg">
              온라인 설문을 작성하시면 전문 심리상담사가 검토 후 법원 제출용
              의견서를 발급해 드립니다.
            </p>
          </header>

          <article className="relative overflow-hidden rounded-[2rem] border-2 border-[var(--color-primary)] bg-white p-8 shadow-xl shadow-[var(--color-primary)]/10 sm:p-10">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/30">
                <FileSignature className="h-7 w-7" />
              </div>
              <div>
                <h3 className="font-sans text-xl font-extrabold text-slate-900 sm:text-2xl">
                  심리상담 의견서
                </h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {COUNSELING_PRODUCT.composition}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="font-sans text-xl font-extrabold text-[var(--color-primary)] sm:text-2xl">
                  {COUNSELING_PRODUCT.price.toLocaleString()}원
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 border-t border-slate-100 pt-6 sm:grid-cols-2">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">
                  상담 목적 및 기대효과
                </p>
                <ul className="mt-3 space-y-2.5">
                  {COUNSELING_PRODUCT.goals.map((g) => (
                    <li key={g} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                      <span className="text-[13px] leading-relaxed text-slate-700">
                        {g}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">
                  진행 절차
                </p>
                <ul className="mt-3 space-y-2.5">
                  {COUNSELING_PRODUCT.process.map((s, i) => (
                    <li key={s} className="flex items-start gap-2.5">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                        {i + 1}
                      </span>
                      <span className="text-[13px] leading-relaxed text-slate-700">
                        {s}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8">
              <ApplyButton
                counselingType={COUNSELING_PRODUCT.type}
                price={COUNSELING_PRODUCT.price}
              />
            </div>
          </article>
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
