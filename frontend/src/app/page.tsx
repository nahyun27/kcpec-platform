"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Spinner } from "@/components/ui/Spinner";
import { useEffect, useRef, useState } from "react";
import { getFaqs, getPosts } from "@/lib/api";
import type { Faq, PostListItem } from "@/types/community";
import SiteHeader from "@/components/layout/SiteHeader";
import {
  ArrowRight,
  ChevronDown,
  CreditCard,
  FileDown,
  FileText,
  PartyPopper,
  PlayCircle,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

// ---------- 스크롤 인뷰 애니메이션 ------------------------------------------
//
// 섹션이 뷰포트에 처음 들어올 때 한 번만 fade+slide-up 시키는 용도.
// tailwindcss-animate 의 1회성 keyframe 대신, IntersectionObserver 로 감지한
// 상태를 그대로 transition 클래스에 반영하는 방식 — 스크롤 위치에 따라
// on/off 를 재계산할 필요 없이 "본 적 있는지"만 기억하면 되기 때문에 더 단순함.
function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li";
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <Tag
      ref={ref as never}
      className={`transition-all duration-700 ease-out ${
        inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

const STEPS = [
  { n: "01", title: "강의 선택", desc: "내 사건과 관련된 교육 과정을 선택합니다." },
  { n: "02", title: "수강 신청·결제", desc: "강의를 수강 신청하고 결제합니다." },
  { n: "03", title: "강의 수강", desc: "완강 및 퀴즈 통과 시 수료." },
  { n: "04", title: "자료 수령", desc: "수료증을 PDF 로 즉시 수령." },
];

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--color-muted)]">
      <SiteHeader />
      <Hero />
      <TrustSection />
      <StepsSection />
      <ReviewsSection />
      <SamplesSection />
      <FaqSection />
      <Footer />
    </div>
  );
}

// ---------- hero -----------------------------------------------------------

function Hero() {
  return (
    <section className="relative flex items-center justify-center overflow-hidden bg-[var(--color-primary)] -mt-16 pt-32 pb-28 md:pb-44 md:pt-44 text-white">
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

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center px-4 md:px-6 text-center">
        <div className="mb-6 mx-auto flex w-fit max-w-[92%] items-center gap-2 rounded-2xl sm:rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2 sm:py-1.5 text-[12px] sm:text-sm font-extrabold text-[#1C3461] shadow-lg shadow-orange-500/20 text-center animate-in fade-in slide-in-from-top-4 duration-700 ease-out">
          <PartyPopper className="h-4 w-4 shrink-0" />
          <span>리뉴얼 기념 할인 이벤트 · 40~60% 할인 중! 국내 최저가! + 10만원 이상 구매 시 10,000원 추가 할인</span>
        </div>
        <div className="mb-8 inline-flex items-center rounded-full border border-white bg-white/5 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-700 delay-150 ease-out">
          <span>신뢰할 수 있는 양형자료</span>
        </div>
        <h1 className="mb-8 font-sans text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-6xl md:text-7xl animate-in fade-in slide-in-from-top-4 duration-700 delay-300 ease-out">
          수사대응 및<br className="md:hidden" /> 재판 준비,{" "}
          <span className="bg-gradient-to-r from-blue-200 via-white to-blue-100 bg-clip-text text-transparent">
            전문 교육으로 시작하세요
          </span>
        </h1>
        <p className="mb-12 max-w-2xl text-[13px] leading-relaxed text-slate-300 sm:text-lg md:text-xl animate-in fade-in slide-in-from-top-4 duration-700 delay-500 ease-out">
          가장 확실한 양형 자료를 준비하세요. 공공기관에 제출 가능한
          교육이수 수료증, 서약서, 심리상담의견서를 과정을 마친 즉시
          발급받을 수 있습니다.
        </p>

        <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-700 ease-out">
          <Link
            href="/sentencing"
            className="group flex items-center justify-center gap-2 rounded-full bg-[#1C3461] px-8 py-4 text-lg font-semibold text-white ring-2 ring-white/40 shadow-xl shadow-black/20 transition-all hover:-translate-y-1 hover:bg-[var(--color-primary-hover)] hover:shadow-2xl"
          >
            <Sparkles className="h-5 w-5 shrink-0 text-white transition-transform group-hover:rotate-12" />
            <span>내 사건에 맞는 교육과정 추천 받기</span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------- trust section (Bento style) -----------------------------------

const TRUST_STATS = [
  { icon: Users, label: "누적 발급 건수", value: "15,000+" },
  { icon: PlayCircle, label: "국내 최다 교육과정 보유", value: "25개 과정" },
  { icon: FileText, label: "수료증 발급", value: "수강완료 즉시" },
  { icon: ShieldCheck, label: "전문가 감수", value: "100% 검증" },
];

function TrustSection() {
  return (
    <section className="relative z-20 -mt-16 px-4 md:px-6">
      <Reveal className="mx-auto max-w-5xl rounded-2xl border border-white/20 bg-white/80 p-8 shadow-2xl backdrop-blur-xl sm:p-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {TRUST_STATS.map((s, idx) => (
            <div
              key={s.label}
              className="group flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1"
              style={{ transitionDelay: `${idx * 60}ms` }}
            >
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[var(--color-accent)] transition-colors duration-300 group-hover:bg-[var(--color-accent)] group-hover:text-white md:h-12 md:w-12">
                <s.icon className="h-5 w-5 md:h-6 md:w-6" />
              </div>
              <dd className="font-sans text-xl font-extrabold text-[var(--color-primary)] md:text-3xl whitespace-nowrap">
                {s.value}
              </dd>
              <dt className="mt-1 text-xs font-medium text-slate-500 md:text-sm">
                {s.label}
              </dt>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

// ---------- reviews ---------------------------------------------------------

// 카드마다 조금씩 다른 아바타 톤을 순환시켜 밋밋함을 덜어냄 (실명 대신
// "익명" 이니셜만 있어서 색으로라도 개별감을 줌). 브랜드 블루 계열 안에서만.
const REVIEW_AVATAR_TONES = [
  "from-[var(--color-primary)] to-blue-600",
  "from-blue-500 to-indigo-500",
  "from-indigo-500 to-[var(--color-primary)]",
  "from-sky-500 to-blue-600",
  "from-[var(--color-accent)] to-blue-500",
  "from-blue-600 to-indigo-600",
];

// 후기 작성자명 익명화 — author_name 은 작성 시 자유 입력값이라 실명이
// 그대로 노출될 수 있어(민감한 범죄예방 교육 서비스 특성상), 표시 시점에
// 가운데 글자를 마스킹한다. "김민석" -> "김*석", "이해" -> "이*".
function maskName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}${"*".repeat(trimmed.length - 2)}${trimmed[trimmed.length - 1]}`;
}

function ReviewsSection() {
  const [reviews, setReviews] = useState<PostListItem[] | null>(null);

  useEffect(() => {
    getPosts("review", 1, 6)
      .then((res) => setReviews(res.items))
      .catch(() => setReviews([]));
  }, []);

  return (
    <section className="relative overflow-hidden py-14 md:py-28">
      {/* 은은한 배경 글로우 — 히어로와 같은 톤으로 페이지 전체 통일감 */}
      <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full bg-blue-100/50 blur-[110px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-indigo-100/40 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 md:px-6">
        <Reveal className="mb-8 md:mb-14 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--color-primary)] ring-1 ring-blue-500/20">
              Testimonials
            </span>
            <h2 className="mt-3 font-sans text-3xl font-extrabold tracking-tight text-[var(--color-primary)] sm:text-4xl">
              수강생 후기
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              실제로 교육을 이수하신 분들의 이야기입니다.
            </p>
          </div>
          <Link
            href="/community?tab=review"
            className="group flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition-all hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            <span>전체 후기 보기</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>

        {reviews == null ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-8 text-center text-zinc-500">
            <Spinner size="sm" tone="accent" />
            <p className="mt-4 font-medium">후기를 불러오는 중입니다...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-8 text-center text-zinc-500">
            <p className="font-medium">아직 등록된 후기가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r, idx) => (
              <Reveal
                key={r.id}
                delay={(idx % 3) * 120}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 md:p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--color-primary)]/20 hover:shadow-xl hover:shadow-[var(--color-primary)]/10"
              >
                <Quote
                  className="pointer-events-none absolute -right-1 -top-1 h-16 w-16 -rotate-6 text-blue-50 transition-colors duration-300 group-hover:text-blue-100"
                  strokeWidth={1.5}
                  aria-hidden
                />

                <div className="relative mb-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < r.rating
                            ? "fill-amber-400 text-amber-400"
                            : "fill-slate-100 text-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  {r.course_category ? (
                    <span className="inline-flex w-fit items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[var(--color-accent)]">
                      {r.course_category}
                    </span>
                  ) : null}
                </div>

                <p className="relative line-clamp-4 flex-1 text-[15px] leading-relaxed text-slate-700">
                  &ldquo;{r.content}&rdquo;
                </p>

                <div className="relative mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-sm ${
                      REVIEW_AVATAR_TONES[idx % REVIEW_AVATAR_TONES.length]
                    }`}
                  >
                    {r.author_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">
                      {maskName(r.author_name)}
                    </p>
                    <p className="text-xs text-slate-400">수강생</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- 4-step guide ---------------------------------------------------

const STEP_ICONS = [Search, PlayCircle, CreditCard, FileDown];
const STEP_TONES = [
  "from-blue-500 to-indigo-500",
  "from-indigo-500 to-[var(--color-primary)]",
  "from-[var(--color-accent)] to-blue-500",
  "from-sky-500 to-blue-600",
];

function StepsSection() {
  return (
    <section id="guide" className="bg-[#FAFBFD] py-16 md:py-28">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <Reveal className="mb-10 md:mb-16 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--color-primary)] ring-1 ring-blue-500/20">
            Guide
          </span>
          <h2 className="mt-3 font-sans text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            쉽고 빠른 이용 절차
          </h2>
          <p className="mt-2 text-sm text-slate-500 md:text-base">
            복잡한 과정 없이 필요한 서류를 즉시 준비하세요
          </p>
        </Reveal>

        {/* Desktop: Horizontal Flow / Mobile: Compact Horizontal List */}
        <div className="relative">
          {/* 데스크톱 전용: 아이콘 사이를 잇는 연결선 (진행 흐름을 시각적으로 표현) */}
          <div className="pointer-events-none absolute inset-x-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent md:block" />

          <div className="flex flex-col gap-4 md:flex-row md:justify-between md:gap-5 relative z-10">
            {STEPS.map((s, idx) => {
              const Icon = STEP_ICONS[idx];
              return (
                <Reveal
                  key={s.n}
                  delay={idx * 120}
                  className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm md:flex-col md:items-center md:text-center md:p-6 md:flex-1 md:rounded-3xl md:shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-[var(--color-primary)]/10"
                >
                  {/* Left (Mobile) / Top (Desktop) - Icon & Number Badge */}
                  <div className="relative shrink-0 flex items-center justify-center">
                    <div
                      className={`flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md ring-4 ring-white ${STEP_TONES[idx]}`}
                    >
                      <Icon className="h-6 w-6 md:h-7 md:w-7" />
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-[var(--color-primary)] ring-2 ring-slate-100 shadow-sm">
                      {s.n}
                    </span>
                  </div>

                  {/* Right (Mobile) / Bottom (Desktop) - Text Content */}
                  <div className="flex-1 md:mt-3 text-left md:text-center">
                    <h3 className="font-sans text-base font-bold text-slate-800 md:text-lg">
                      {s.title}
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-500 break-keep">
                      {s.desc}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
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
    <section id="samples" className="bg-[#F8F9FA] py-16 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6 text-center">
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--color-primary)] ring-1 ring-blue-500/20">
            Documents
          </span>
          <h2 className="mt-3 font-sans text-2xl font-extrabold leading-snug tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
            교육과 상담을 통해 변화된 자신을 발견하고
            <br />
            건전한 사회구성원으로 복귀할 수 있습니다.
          </h2>
        </Reveal>

        {/* Horizontal scroll container on mobile, 3-column grid on desktop */}
        <div className="hide-scrollbar -mx-4 mt-10 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:mt-14 sm:grid sm:grid-cols-3 sm:gap-8 sm:px-0 sm:pb-0">
          {SAMPLES.map((s, idx) => (
            <Reveal key={s.src} delay={idx * 120} className="w-[180px] shrink-0 snap-center sm:w-auto">
              <figure
                onClick={() => setSelectedImg(s)}
                className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:rotate-[0.5deg] hover:shadow-xl hover:shadow-[var(--color-primary)]/10 cursor-pointer"
              >
                <div className="overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.src}
                    alt={s.caption}
                    className="aspect-[3/4] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <figcaption className="border-t border-zinc-100 py-3.5 text-xs sm:text-sm font-semibold text-slate-700">
                  {s.caption}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-xs text-slate-500">
          ※ 위 이미지는 샘플로, 교육 과정 별로 일부 상이합니다. (클릭 시 확대)
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
  const [faqs, setFaqs] = useState<Faq[] | null>(null);

  useEffect(() => {
    getFaqs()
      .then(setFaqs)
      .catch(() => setFaqs([]));
  }, []);

  return (
    <section id="faq" className="bg-white py-16 md:py-28">
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        <Reveal className="mb-8 md:mb-12 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--color-primary)] ring-1 ring-blue-500/20">
            FAQ
          </span>
          <h2 className="mt-3 font-sans text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            자주 묻는 질문
          </h2>
        </Reveal>

        {faqs == null ? (
          <div className="flex min-h-[160px] items-center justify-center">
            <Spinner size="sm" tone="accent" />
          </div>
        ) : (
          <div className="space-y-4">
            {faqs.map((item, idx) => {
              const isOpen = openIdx === idx;
              return (
                <div
                  key={item.id}
                  className={`overflow-hidden rounded-2xl border transition-colors duration-300 ${isOpen ? 'border-[var(--color-accent)] bg-blue-50/30' : 'border-zinc-200 bg-white hover:border-zinc-300'}`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIdx(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 px-4 md:px-6 py-5 text-left"
                  >
                    <span className={`font-sans text-base font-bold sm:text-lg ${isOpen ? 'text-[var(--color-primary)]' : 'text-slate-800'}`}>
                      Q. {item.question}
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
                        {item.answer}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
            국내 최다 범죄예방 교육과정 보유, 범죄관련 심리상담 전문 기관.
            공공기관(경찰, 검찰, 법원 등)에 제출 가능한 가장 확실하고
            신뢰할 수 있는 양형 자료를 제공합니다.
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
            ⓒ 2024 한국범죄예방교육센터. All rights reserved.
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
