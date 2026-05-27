"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Spinner } from "@/components/ui/Spinner";
import { useEffect, useState } from "react";
import { getCourses } from "@/lib/api";
import type { CourseListItem } from "@/types/course";
import SiteHeader from "@/components/layout/SiteHeader";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileDown,
  FileText,
  PlayCircle,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "수료증 또는 상담의견서 등은 언제 어떻게 받을 수 있나요?",
    a: "수강자가 강의를 수강한 내역이 확인되면 익일 24시까지 가입하신 이메일을 통해 pdf파일로 보내드립니다.\n상담의견서는 상담 후 24시간 이내에 가입하신 이메일을 통해 pdf파일로 보내드립니다.",
  },
  {
    q: "수료증을 재발급 받을 수 있나요?",
    a: "수료증을 재발급 받기 위해서는 법령에 따른 개인정보 보관 기간 내에 admin@kcpec.co.kr 이메일로 문의주시면 1회에 한하여 재발급해드립니다.",
  },
  {
    q: "환불 및 취소가 가능한가요?",
    a: "결제 오류에 대한 환불이나 취소는 가능하나, 강의 수강 시작 후 또는 상담 의뢰 후 환불이나 취소는 불가합니다.",
  },
  {
    q: "상담 절차는 어떻게 진행되나요?",
    a: "기본 상담 절차는 이용자가 상담 설문지를 작성하여 제출하는 서면상담 방식으로 진행됩니다.\n심화상담은 의뢰를 하실 경우 상담사와 일정을 맞춘 후 상담사가 해당 시간에 이용자에게 전화를 드리거나 대면상담을 진행합니다.\n모든 상담이 종료된 후 24시간 이내에 상담의견서 등을 pdf파일로 가입하신 이메일로 보내드립니다.",
  },
  {
    q: "발급받은 서류를 법원이나 수사기관에 제출해도 되나요?",
    a: "네, 저희 센터에서 발급한 수료증, 상담 의견서, 서약서 등 자료는 법원이나 수사기관, 학교 등 공공기관에 제출하셔도 됩니다.",
  },
  {
    q: "양형자료만 내면 무조건 감형이 되는 건가요?",
    a: "그렇지 않습니다. 검찰이나 법원의 양형판단은 다양한 요소들을 바탕으로 종합적으로 이루어지기 때문입니다.\n다만 수료증, 상담 의견서 등 양형자료는 재범예방교육 또는 심리상담을 통해 피고인(또는 피의자)이 재범하지 않을 것을 굳게 다짐하고 있다는 사정을 경찰, 검찰이나 법원에 알리는 효과적인 방법이 될 수 있습니다.",
  },
  {
    q: "발급받은 서류의 진위 확인이 가능한가요?",
    a: "네 가능합니다. 저희 센터에서 발급하는 서류는 워터마크가 삽입되어 있으며 문서일련번호로 진위 확인이 가능합니다.\n서류의 진위확인을 원하시는 경우, 서류 사본과 문의하실 내용을 적어 admin@kcpec.co.kr로 이메일 문의를 주시면 답변드립니다.",
  },
  {
    q: "사건에 대한 변호사 상담을 받을 수 있나요?",
    a: "본 센터는 변호사 소개나 알선, 상담을 제공하지 않습니다.",
  },
];

const PACKAGES = [
  {
    tier: "Basic",
    description: "수료증 단건 발급",
    items: ["수료증 PDF 발급"],
  },
  {
    tier: "Standard",
    description: "수료증 + 심리상담 의견서 + 양형자료 가이드",
    items: ["수료증", "심리상담 의견서", "양형자료 가이드"],
    highlight: true,
  },
  {
    tier: "Premium",
    description: "수료증 + 심리상담 의견서 + 양형자료 가이드 외 모든 양형 자료",
    items: [
      "수료증",
      "심리상담 의견서",
      "양형자료 가이드",
      "CBT 자료",
      "탄원서 샘플",
      "교육이수 소감문",
      "자기성찰리포트",
    ],
  },
];

const STEPS = [
  { n: "01", title: "강의 선택", desc: "내 사건과 관련된 교육 과정을 선택합니다." },
  { n: "02", title: "강의 수강", desc: "진도와 퀴즈로 수료 처리." },
  { n: "03", title: "패키지 결제", desc: "필요한 발급 자료에 맞춰 패키지 선택." },
  { n: "04", title: "자료 수령", desc: "수료증·의견서를 PDF 로 즉시/빠르게 수령." },
];

export default function HomePage() {
  const [courses, setCourses] = useState<CourseListItem[]>([]);

  useEffect(() => {
    getCourses().then(setCourses).catch(() => setCourses([]));
  }, []);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--color-muted)]">
      <SiteHeader />
      <Hero />
      <TrustSection />
      <CoursesSection courses={courses} />
      <StepsSection />
      <PackagesSection />
      <SamplesSection />
      <FaqSection />
      <Footer />
    </div>
  );
}

// ---------- hero -----------------------------------------------------------

function Hero() {
  return (
    <section className="relative flex items-center justify-center overflow-hidden bg-[var(--color-primary)] py-10 pb-20 md:pb-36 md:pt-24 text-white">
      {/* Noise Texture Overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      ></div>
      {/* Subtle Glows */}
      <div className="pointer-events-none absolute -left-[10%] top-0 h-[500px] w-[500px] rounded-full bg-[var(--color-accent)] opacity-20 blur-[120px]"></div>
      <div className="pointer-events-none absolute -right-[10%] bottom-0 h-[600px] w-[600px] rounded-full bg-blue-600 opacity-10 blur-[150px]"></div>

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-4 md:px-6 text-center">
        <div className="mb-6 inline-flex items-center rounded-full border border-white bg-white/5 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-md">
          <span>법원 및 수사기관 제출용 신뢰할 수 있는 교육</span>
        </div>
        <h1 className="mb-6 font-sans text-5xl font-extrabold leading-[1.15] tracking-tight sm:text-6xl md:text-7xl">
          재판 준비, <br className="md:hidden" />
          <span className="bg-gradient-to-r from-blue-200 via-white to-blue-100 bg-clip-text text-transparent">
            전문 교육으로 시작하세요
          </span>
        </h1>
        <p className="mb-10 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
          가장 확실한 양형 자료를 준비하세요. 법원이 인정하는 심리·준법 교육
          수료증을 무료로 수강하고 즉시 발급받을 수 있습니다.
        </p>

        <div className="flex flex-col items-center gap-4">
          <Link
            href="/sentencing"
            className="group flex items-center justify-center gap-2 rounded-full bg-[#1C3461] px-8 py-4 text-lg font-semibold text-white ring-2 ring-white/40 shadow-xl shadow-black/20 transition-all hover:-translate-y-1 hover:bg-[var(--color-primary-hover)] hover:shadow-2xl"
          >
            <span>내 사건에 맞는 양형자료 추천받기</span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/courses"
            className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
          >
            강의 목록에서 직접 선택 →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------- trust section (Bento style) -----------------------------------

function TrustSection() {
  return (
    <section className="relative z-20 -mt-16 px-4 md:px-6">
      <div className="mx-auto max-w-5xl rounded-2xl border border-white/20 bg-white/80 p-8 shadow-2xl backdrop-blur-xl sm:p-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <TrustStat icon={<Users className="mb-2 h-6 w-6 text-[var(--color-accent)]" />} label="누적 수강생" value="10,000+" />
          <TrustStat icon={<PlayCircle className="mb-2 h-6 w-6 text-[var(--color-accent)]" />} label="교육 종류" value="11개 과정" />
          <TrustStat icon={<FileText className="mb-2 h-6 w-6 text-[var(--color-accent)]" />} label="수료증 발급" value="당일 즉시" />
          <TrustStat icon={<ShieldCheck className="mb-2 h-6 w-6 text-[var(--color-accent)]" />} label="전문가 감수" value="100% 검증" />
        </div>
      </div>
    </section>
  );
}

function TrustStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      {icon}
      <dd className="font-sans text-xl font-extrabold text-[var(--color-primary)] md:text-3xl whitespace-nowrap">{value}</dd>
      <dt className="mt-1 text-xs font-medium text-slate-500 md:text-sm whitespace-nowrap">{label}</dt>
    </div>
  );
}

// ---------- courses --------------------------------------------------------

function CoursesSection({ courses }: { courses: CourseListItem[] }) {
  return (
    <section className="py-8 md:py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-6 md:mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h2 className="font-sans text-3xl font-extrabold tracking-tight text-[var(--color-primary)] sm:text-4xl">
              맞춤형 교육 과정
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              사건에 가장 적합한 교육을 선택하세요.
            </p>
          </div>
          <Link
            href="/courses"
            className="group flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition-all hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            <span>전체 강의 보기</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-8 text-center text-zinc-500">
            <Spinner size="sm" tone="accent" />
            <p className="mt-4 font-medium">강의 정보를 불러오는 중입니다...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.id}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 md:p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-[var(--color-primary)]/5"
              >
                <div className="mb-4 inline-flex w-fit items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[var(--color-accent)]">
                  {c.category}
                </div>
                <h3 className="mb-4 font-sans text-lg md:text-xl font-bold leading-snug text-slate-900 group-hover:text-[var(--color-primary)]">
                  {c.title}
                </h3>
                <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="flex items-center gap-1 text-sm font-medium text-slate-500">
                    <PlayCircle className="h-4 w-4" /> 수강하기
                  </span>
                  <span className="font-bold text-[var(--color-primary)]">
                    {c.price.toLocaleString()}원~
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- 4-step guide ---------------------------------------------------

function StepsSection() {
  const stepIcons = [Search, PlayCircle, CreditCard, FileDown];

  return (
    <section id="guide" className="bg-[#FAFBFD] py-12 md:py-20">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <div className="mb-10 md:mb-16 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--color-primary)] ring-1 ring-blue-500/20">
            Guide
          </span>
          <h2 className="mt-3 font-sans text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            쉽고 빠른 이용 절차
          </h2>
          <p className="mt-2 text-sm text-slate-500 md:text-base">
            복잡한 과정 없이 꼭 필요한 서류만 빠르게 준비하세요.
          </p>
        </div>

        {/* Desktop: Horizontal Flow / Mobile: Compact Horizontal List */}
        <div className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:justify-between md:gap-5 relative z-10">
            {STEPS.map((s, idx) => {
              const Icon = stepIcons[idx];
              return (
                <div 
                  key={s.n} 
                  className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm md:flex-col md:items-center md:text-center md:p-6 md:flex-1 md:rounded-3xl md:shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  {/* Left (Mobile) / Top (Desktop) - Icon & Number Badge */}
                  <div className="relative shrink-0 flex items-center justify-center">
                    <div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 text-[var(--color-primary)] ring-1 ring-slate-200/50">
                      <Icon className="h-6 w-6 md:h-7 md:w-7" />
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-extrabold text-white ring-2 ring-white">
                      {s.n}
                    </span>
                  </div>

                  {/* Right (Mobile) / Bottom (Desktop) - Text Content */}
                  <div className="flex-1 md:mt-2 text-left md:text-center">
                    <h3 className="font-sans text-base font-bold text-slate-800 md:text-lg">
                      {s.title}
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-500">
                      {s.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- packages -------------------------------------------------------

function PackagesSection() {
  return (
    <section className="py-8 md:py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-6 md:mb-16 text-center">
          <h2 className="font-sans text-3xl font-extrabold tracking-tight text-[var(--color-primary)] sm:text-4xl">
            합리적인 패키지
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            자신의 상황에 맞는 맞춤형 자료 패키지를 선택하세요.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
          {PACKAGES.map((p) => (
            <div
              key={p.tier}
              className={`relative flex flex-col rounded-3xl bg-white p-5 md:p-8 transition-all duration-300 hover:-translate-y-2 ${
                p.highlight
                  ? "border-2 border-[var(--color-accent)] shadow-2xl shadow-blue-900/10 scale-105 z-10"
                  : "border border-zinc-200 shadow-lg mt-4 mb-4"
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-accent)] px-4 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
                  Most Popular
                </div>
              )}
              <div className="mb-5 md:mb-6">
                <h3 className="font-sans text-xl md:text-2xl font-bold text-[var(--color-primary)]">
                  {p.tier}
                </h3>
                <p className="mt-2 text-sm text-slate-500">{p.description}</p>
              </div>
              
              <ul className="mb-8 mt-2 flex-1 space-y-4 text-slate-700">
                {p.items.map((it) => (
                  <li key={it} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent)]" />
                    <span className="font-medium">{it}</span>
                  </li>
                ))}
              </ul>
              
              <div className="mt-auto">
                <div className={`w-full rounded-xl py-3 text-center text-sm font-bold transition-colors ${p.highlight ? 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                  결제 시 가격 확인
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- 서류 예시 ------------------------------------------------------

const SAMPLES = [
  { src: "/images/sample-certificate.png", caption: "수료증 예시" },
  { src: "/images/sample-counseling.png", caption: "심리상담 의견서 예시" },
  { src: "/images/sample-pledge.png", caption: "서약서 예시" },
];

function SamplesSection() {
  const [selectedImg, setSelectedImg] = useState<{ src: string; caption: string } | null>(null);

  return (
    <section id="samples" className="bg-[#F8F9FA] py-8 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6 text-center">
        <h2 className="font-sans text-xl font-extrabold leading-snug tracking-tight text-[var(--color-primary)] md:text-2xl sm:text-3xl">
          교육과 상담을 통해 변화된 자신을 발견하고
          <br />
          건전한 사회구성원으로 복귀할 수 있습니다.
        </h2>
        
        {/* Horizontal scroll container on mobile, 3-column grid on desktop */}
        <div className="hide-scrollbar -mx-4 mt-8 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:mt-12 sm:grid sm:grid-cols-3 sm:gap-6 sm:px-0 sm:pb-0">
          {SAMPLES.map((s) => (
            <figure
              key={s.src}
              onClick={() => setSelectedImg(s)}
              className="w-[180px] shrink-0 snap-center overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-transform duration-300 hover:-translate-y-1 sm:w-auto cursor-pointer hover:shadow-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.src}
                alt={s.caption}
                className="aspect-[3/4] w-full object-cover"
              />
              <figcaption className="border-t border-zinc-100 py-3.5 text-xs sm:text-sm font-semibold text-slate-700">
                {s.caption}
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-6 text-xs text-slate-500">
          ※ 위 이미지는 샘플로, 실제 발급 양식과 다를 수 있습니다. (클릭 시 확대)
        </p>
      </div>

      {/* Image Modal for Zoom */}
      {selectedImg && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-300 p-4"
          onClick={() => setSelectedImg(null)}
        >
          <div 
            className="relative max-h-[90vh] max-w-[95vw] sm:max-w-md overflow-hidden rounded-3xl bg-white p-2 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImg.src}
              alt={selectedImg.caption}
              className="max-h-[70vh] w-auto rounded-2xl object-contain mx-auto"
            />
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 mt-2">
              <span className="text-sm font-bold text-slate-800">{selectedImg.caption}</span>
              <button 
                type="button"
                onClick={() => setSelectedImg(null)}
                className="rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- FAQ ------------------------------------------------------------

function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  
  return (
    <section id="faq" className="bg-white py-12 md:py-24">
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        <div className="mb-8 md:mb-12 text-center">
          <h2 className="font-sans text-3xl font-extrabold tracking-tight text-[var(--color-primary)] sm:text-4xl">
            자주 묻는 질문
          </h2>
        </div>
        
        <div className="space-y-4">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className={`overflow-hidden rounded-2xl border transition-colors duration-300 ${isOpen ? 'border-[var(--color-accent)] bg-blue-50/30' : 'border-zinc-200 bg-white hover:border-zinc-300'}`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between gap-4 px-4 md:px-6 py-5 text-left"
                >
                  <span className={`font-sans text-base font-bold sm:text-lg ${isOpen ? 'text-[var(--color-primary)]' : 'text-slate-800'}`}>
                    Q. {item.q}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ${
                      isOpen ? "rotate-180 text-[var(--color-accent)]" : ""
                    }`}
                  />
                </button>
                <div
                  className={`grid transition-all duration-300 ease-in-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="whitespace-pre-line px-4 md:px-6 pb-6 pt-2 text-base leading-relaxed text-slate-600">
                      <span className="font-bold text-[var(--color-accent)] mr-2">A.</span>
                      {item.a}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/community?tab=faq"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)] hover:text-white"
          >
            더 많은 질문 보기
            <ChevronDown className="h-4 w-4 -rotate-90" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------- footer ---------------------------------------------------------

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-[var(--color-primary)] pt-16 text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 md:px-6 pb-12 md:grid-cols-12">
        <div className="space-y-6 md:col-span-5 lg:col-span-4">
          <Logo variant="white" />
          <p className="text-sm leading-relaxed text-slate-400">
            법원이 인정하는 재범방지 교육 및 심리상담 전문 기관. 
            가장 확실하고 신뢰할 수 있는 양형 자료를 제공합니다.
          </p>
        </div>
        
        <div className="md:col-span-7 lg:col-span-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div className="space-y-4">
            <h4 className="font-sans text-lg font-bold text-white">고객지원</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li>
                <span className="block text-slate-500 mb-1">상담문의</span>
                <a href="tel:01063773325" className="font-medium text-white hover:text-[var(--color-accent)] transition-colors">
                  010-6377-3325
                </a>
              </li>
              <li>
                <span className="block text-slate-500 mb-1">이메일</span>
                <a href="mailto:admin@kcpec.co.kr" className="font-medium text-white hover:text-[var(--color-accent)] transition-colors">
                  admin@kcpec.co.kr
                </a>
              </li>
              <li>
                <span className="block text-slate-500 mb-1">무통장 입금 계좌</span>
                <span className="text-white">기업은행 232-160450-04-015</span>
                <br />
                <span className="text-slate-500 text-xs">(예금주: 한국범죄예방교육센터)</span>
              </li>
            </ul>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-sans text-lg font-bold text-white">회사 정보</h4>
            <ul className="space-y-2 text-sm text-slate-400 leading-relaxed">
              <li><strong className="text-slate-300">상호:</strong> 주식회사 한국범죄예방교육센터</li>
              <li><strong className="text-slate-300">대표:</strong> 윤승진</li>
              <li><strong className="text-slate-300">주소:</strong> 서울 강남구 언주로147길 42, 2층 2602호(논현동)</li>
              <li><strong className="text-slate-300">사업자등록번호:</strong> 495-86-03325</li>
              <li><strong className="text-slate-300">통신판매업신고:</strong> 제2024-서울강남-02655호</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="border-t border-white/10 bg-black/20">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 md:px-6 py-6 sm:flex-row">
          <p className="text-sm text-slate-500">
            ⓒ {new Date().getFullYear()} 한국범죄예방교육센터. All rights reserved.
          </p>
          <div className="flex gap-4 text-sm text-slate-500">
            <Link href="/terms" className="hover:text-white transition-colors">이용약관</Link>
            <Link href="/privacy" className="hover:text-white transition-colors font-medium">개인정보처리방침</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
