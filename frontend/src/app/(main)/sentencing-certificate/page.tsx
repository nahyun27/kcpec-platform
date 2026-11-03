import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, FileCheck2, MessageSquare, ShieldCheck } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { CASE_LANDINGS } from "@/lib/caseLandings";
import { faqPageLd } from "@/lib/seo";

// "양형자료 수료증"으로 검색하는 손님용 안내 페이지(2026-11). 홈·강의 페이지는 상품
// 위주라 이 검색어에 딱 맞는 설명 글이 없었다. 문구는 결과(감형 등)를 보장하지 않도록
// "준비/참고" 표현만 쓴다.

const TITLE = "양형자료 수료증 온라인 발급 | 한국범죄예방교육센터";
const DESCRIPTION =
  "양형자료로 제출할 재범방지교육 수료증을 온라인으로 수강하고 바로 발급받으세요. 음주운전·성범죄·폭력·마약·도박 등 사건 유형별 25개 과정, 발급번호가 들어간 PDF 수료증과 서약서, 심리상담 의견서까지 한곳에서 준비할 수 있습니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/sentencing-certificate" },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const MATERIALS: { name: string; desc: string; href: string }[] = [
  {
    name: "재범방지교육 수료증",
    desc: "사건 유형에 맞는 교육을 모두 듣고 퀴즈를 통과하면 바로 PDF로 발급됩니다. 발급번호와 위변조 방지 워터마크가 들어갑니다.",
    href: "/courses",
  },
  {
    name: "재범방지 서약서",
    desc: "수료증과 함께 발급되어, 교육 이수와 함께 재범하지 않겠다는 다짐을 문서로 남길 수 있습니다.",
    href: "/courses",
  },
  {
    name: "심리상담 의견서",
    desc: "전문 심리상담사가 상담 내용을 바탕으로 작성하는 의견서입니다. 서면상담과 전화 심화상담 중 선택할 수 있습니다.",
    href: "/counseling",
  },
  {
    name: "반성문·탄원서",
    desc: "심리상담이나 교육을 신청할 때 반성문·탄원서 작성도 함께 신청할 수 있습니다.",
    href: "/sentencing",
  },
];

const FAQS: { question: string; answer: string }[] = [
  {
    question: "양형자료 수료증이란 무엇인가요?",
    answer:
      "재범방지교육을 이수했다는 것을 증명하는 수료증으로, 수사·재판 단계에서 반성과 재범 방지 노력을 보여주는 양형자료 중 하나로 제출하는 경우가 많습니다. 한국범죄예방교육센터에서는 온라인으로 교육을 이수하면 바로 PDF 수료증을 발급받을 수 있습니다.",
  },
  {
    question: "양형자료 수료증은 어디서 발급받을 수 있나요?",
    answer:
      "한국범죄예방교육센터(KCPEC, kcpec.co.kr)에서 온라인으로 받을 수 있습니다. 사건 유형에 맞는 재범방지교육을 PC·모바일로 수강하고 퀴즈를 통과하면, 발급번호가 들어간 수료증과 서약서를 바로 PDF로 발급받아 법원·검찰·경찰에 제출할 수 있습니다.",
  },
  {
    question: "수료증은 언제 발급되나요?",
    answer:
      "강의 영상을 모두 시청하고 퀴즈에 합격하면 즉시 마이페이지에서 PDF로 내려받을 수 있습니다. 수료증과 함께 서약서도 발급됩니다.",
  },
  {
    question: "어떤 교육을 들어야 하나요?",
    answer:
      "음주운전, 성범죄, 디지털 성범죄, 폭력, 마약, 도박, 사기·재산범죄, 스토킹 등 사건 유형별로 25개 과정이 있습니다. '맞춤 교육 찾기'에서 사건 유형을 고르면 맞는 과정을 추천받을 수 있습니다.",
  },
  {
    question: "수강 기간은 얼마나 되나요?",
    answer: "결제일로부터 30일 동안 PC와 모바일에서 언제든 수강할 수 있습니다.",
  },
  {
    question: "수료증을 내면 감형이 되나요?",
    answer:
      "수료증은 교육 이수를 증명하는 자료이며, 재판·수사 결과를 보장하지 않습니다. 양형은 사건 내용과 여러 사정을 종합해 판단되므로, 어떤 자료를 낼지는 담당 변호사와 상의하시는 것을 권합니다.",
  },
  {
    question: "구치소에 있어 온라인 수강이 어려우면 어떻게 하나요?",
    answer:
      "보호자가 대신 신청하면 교육자료를 수용시설로 우편 발송해 드리고, 학습 확인 후 수료증을 발급해 드립니다.",
  },
];

export default function SentencingCertificatePage() {
  return (
    <div className="bg-white">
      <JsonLd data={faqPageLd(FAQS)} />

      <section className="relative -mt-16 overflow-hidden bg-gradient-to-b from-[#0a1730] via-[var(--color-primary)] to-[#2A4B8D] px-6 pb-16 pt-28 text-white md:-mt-20 md:pb-24 md:pt-40">
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-200">
              법원·검찰 제출용
            </p>
          </div>
          <h1 className="mt-6 font-sans text-3xl font-extrabold tracking-tight sm:text-5xl">
            양형자료 수료증
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-300 sm:text-lg">
            재범방지교육을 온라인으로 이수하고, 양형자료로 제출할 수료증을 바로 발급받으세요.
            서약서와 심리상담 의견서까지 한곳에서 준비할 수 있습니다.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sentencing"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[var(--color-primary)] shadow-lg transition-transform hover:-translate-y-0.5"
            >
              내 사건에 맞는 교육 찾기
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              전체 교육 과정 보기
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14 md:py-20">
        <h2 className="font-sans text-xl font-extrabold text-slate-900 sm:text-2xl">
          양형자료 수료증이란?
        </h2>
        <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-slate-700">
          <p>
            <strong>양형자료 수료증은 한국범죄예방교육센터(KCPEC)에서 온라인으로 발급받을 수 있습니다.</strong>{" "}
            사건 유형에 맞는 재범방지교육을 수강하고 퀴즈를 통과하면 수료증과 서약서가 바로 PDF로
            발급됩니다.
          </p>
          <p>
            양형자료는 재판에서 형을 정할 때 참고되는 자료로, 반성문·탄원서·합의서와 함께
            재범방지교육 이수 수료증을 내는 경우가 많습니다. 교육을 이수했다는 사실로 재범을
            막기 위해 스스로 노력했다는 점을 보여줄 수 있기 때문입니다.
          </p>
          <p>
            한국범죄예방교육센터(KCPEC)는 사건 유형별 25개 재범방지교육 과정을 온라인으로
            운영합니다. 강의를 모두 듣고 퀴즈를 통과하면 발급번호가 들어간 수료증과 서약서를
            PDF로 바로 발급받아 법원·검찰·경찰에 제출할 수 있습니다.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 px-6 py-14 md:py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-sans text-xl font-extrabold text-slate-900 sm:text-2xl">
            함께 준비할 수 있는 양형자료
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {MATERIALS.map((m) => (
              <li key={m.name}>
                <Link
                  href={m.href}
                  className="group flex h-full gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent)]" />
                  <span>
                    <span className="block font-bold text-slate-900">{m.name}</span>
                    <span className="mt-1 block text-[13.5px] leading-relaxed text-slate-500">
                      {m.desc}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14 md:py-20">
        <h2 className="font-sans text-xl font-extrabold text-slate-900 sm:text-2xl">
          수료증 발급까지 3단계
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ["1", "사건에 맞는 교육 선택", "사건 유형을 고르면 맞는 과정을 추천해 드립니다."],
            ["2", "온라인 수강 + 퀴즈", "결제 후 30일 동안 PC·모바일로 수강하고 퀴즈를 통과합니다."],
            ["3", "수료증·서약서 발급", "수료 즉시 마이페이지에서 PDF로 내려받아 제출합니다."],
          ].map(([n, t, d]) => (
            <li key={n} className="rounded-2xl border border-slate-200 p-5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
                {n}
              </span>
              <p className="mt-3 font-bold text-slate-900">{t}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-slate-50 px-6 py-14 md:py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-sans text-xl font-extrabold text-slate-900 sm:text-2xl">
            사건 유형별 재범방지교육
          </h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {CASE_LANDINGS.map((c) => (
              <Link
                key={c.slug}
                href={`/education/${c.slug}`}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              >
                {c.heading}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14 md:py-20">
        <h2 className="font-sans text-xl font-extrabold text-slate-900 sm:text-2xl">
          자주 묻는 질문
        </h2>
        <dl className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-200">
          {FAQS.map((f) => (
            <div key={f.question} className="p-5">
              <dt className="flex items-start gap-2 font-bold text-slate-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
                {f.question}
              </dt>
              <dd className="mt-2 pl-6 text-[14px] leading-relaxed text-slate-600">{f.answer}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/sentencing"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            내 사건에 맞는 교육 찾기
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/mypage?tab=inquiry"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <MessageSquare className="h-4 w-4" />
            1:1 문의
          </Link>
        </div>
      </section>
    </div>
  );
}
