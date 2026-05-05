"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCourses } from "@/lib/api";
import type { CourseListItem } from "@/types/course";
import SiteHeader from "@/components/layout/SiteHeader";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FileText,
  PlayCircle,
  ShieldCheck,
  Star,
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
    description: "이수증 단건 발급",
    items: ["이수증 PDF 발급"],
  },
  {
    tier: "Standard",
    description: "이수증 + 양형자료 가이드 + 심리상담 의견서",
    items: ["이수증", "양형자료 가이드", "심리상담 의견서"],
    highlight: true,
  },
  {
    tier: "Premium",
    description: "이수증 + 모든 양형 자료 패키지",
    items: ["이수증", "양형자료 가이드", "심리상담 의견서", "CBT 자료", "1:1 상담"],
  },
];

const STEPS = [
  { n: "01", title: "강의 선택", desc: "내 사건과 관련된 교육 과정을 선택합니다." },
  { n: "02", title: "무료 수강", desc: "전 과정 무료. 진도와 퀴즈로 수료 처리." },
  { n: "03", title: "패키지 결제", desc: "필요한 발급 자료에 맞춰 패키지 선택." },
  { n: "04", title: "자료 수령", desc: "이수증·의견서를 PDF 로 즉시/빠르게 수령." },
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
    <section className="relative flex min-h-[85vh] items-center justify-center overflow-hidden bg-[var(--color-primary)] py-20 text-white">
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

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-[var(--color-accent)] backdrop-blur-md">
          <Star className="h-4 w-4" />
          <span>법원 및 수사기관 제출용 신뢰할 수 있는 교육</span>
        </div>
        <h1 className="mb-6 font-sans text-5xl font-extrabold leading-[1.15] tracking-tight sm:text-6xl md:text-7xl">
          재판 준비, <br className="md:hidden" />
          <span className="bg-gradient-to-r from-teal-200 via-white to-teal-100 bg-clip-text text-transparent">
            전문 교육으로 시작하세요
          </span>
        </h1>
        <p className="mb-10 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
          가장 확실한 양형 자료를 준비하세요. 법원이 인정하는 심리·준법 교육 수료증을
          무료로 수강하고 즉시 발급받을 수 있습니다.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/courses"
            className="group flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-8 py-4 text-base font-bold text-white shadow-lg shadow-teal-900/50 transition-all hover:-translate-y-1 hover:bg-[var(--color-accent-hover)] hover:shadow-xl hover:shadow-teal-900/50"
          >
            <span>무료 수강 시작하기</span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="#guide"
            className="flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-8 py-4 text-base font-bold text-white backdrop-blur-sm transition-all hover:bg-white/10"
          >
            이용 안내 보기
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------- trust section (Bento style) -----------------------------------

function TrustSection() {
  return (
    <section className="relative z-20 -mt-16 px-6">
      <div className="mx-auto max-w-5xl rounded-2xl border border-white/20 bg-white/80 p-8 shadow-2xl backdrop-blur-xl sm:p-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <TrustStat icon={<Users className="mb-2 h-6 w-6 text-[var(--color-accent)]" />} label="누적 수강생" value="10,000+" />
          <TrustStat icon={<PlayCircle className="mb-2 h-6 w-6 text-[var(--color-accent)]" />} label="교육 종류" value="11개 과정" />
          <TrustStat icon={<FileText className="mb-2 h-6 w-6 text-[var(--color-accent)]" />} label="이수증 발급" value="당일 즉시" />
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
      <dd className="font-sans text-2xl font-extrabold text-[var(--color-primary)] sm:text-3xl">{value}</dd>
      <dt className="mt-1 text-sm font-medium text-slate-500">{label}</dt>
    </div>
  );
}

// ---------- courses --------------------------------------------------------

function CoursesSection({ courses }: { courses: CourseListItem[] }) {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h2 className="font-sans text-3xl font-extrabold tracking-tight text-[var(--color-primary)] sm:text-4xl">
              맞춤형 교육 과정
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              사건에 가장 적합한 교육을 선택하세요. 모든 수강은 무료입니다.
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
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-[var(--color-accent)]"></div>
            <p className="mt-4 font-medium">강의 정보를 불러오는 중입니다...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.id}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-[var(--color-primary)]/5"
              >
                <div className="mb-4 inline-flex w-fit items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-[var(--color-accent)]">
                  {c.category}
                </div>
                <h3 className="mb-4 font-sans text-xl font-bold leading-snug text-slate-900 group-hover:text-[var(--color-primary)]">
                  {c.title}
                </h3>
                <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="flex items-center gap-1 text-sm font-medium text-slate-500">
                    <PlayCircle className="h-4 w-4" /> 무료 수강
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
  return (
    <section id="guide" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <h2 className="font-sans text-3xl font-extrabold tracking-tight text-[var(--color-primary)] sm:text-4xl">
            쉽고 빠른 이용 절차
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            복잡한 과정 없이 꼭 필요한 서류만 빠르게 준비하세요.
          </p>
        </div>

        <div className="relative">
          {/* Connecting Line */}
          <div className="absolute left-[2.5rem] top-12 bottom-12 hidden w-0.5 bg-slate-100 lg:block"></div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4 lg:gap-12">
            {STEPS.map((s, idx) => (
              <div key={s.n} className="relative flex flex-col items-start lg:items-center lg:text-center">
                <div className="z-10 mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-2xl font-extrabold text-[var(--color-accent)] shadow-inner ring-4 ring-white lg:h-24 lg:w-24 lg:text-3xl">
                  {s.n}
                </div>
                <h3 className="mb-3 font-sans text-xl font-bold text-slate-900">
                  {s.title}
                </h3>
                <p className="text-base text-slate-600 leading-relaxed max-w-[250px]">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- packages -------------------------------------------------------

function PackagesSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
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
              className={`relative flex flex-col rounded-3xl bg-white p-8 transition-all duration-300 hover:-translate-y-2 ${
                p.highlight
                  ? "border-2 border-[var(--color-accent)] shadow-2xl shadow-teal-900/10 scale-105 z-10"
                  : "border border-zinc-200 shadow-lg mt-4 mb-4"
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-accent)] px-4 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
                  Most Popular
                </div>
              )}
              <div className="mb-6">
                <h3 className="font-sans text-2xl font-bold text-[var(--color-primary)]">
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
  return (
    <section id="samples" className="bg-[#F8F9FA] py-24">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="font-sans text-2xl font-extrabold leading-snug tracking-tight text-[var(--color-primary)] sm:text-3xl">
          교육과 상담을 통해 변화된 자신을 발견하고
          <br />
          건전한 사회구성원으로 복귀할 수 있습니다.
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {SAMPLES.map((s) => (
            <figure
              key={s.src}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-transform hover:-translate-y-1"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.src}
                alt={s.caption}
                className="aspect-[3/4] w-full object-cover"
              />
              <figcaption className="border-t border-zinc-100 py-4 text-sm font-semibold text-slate-700">
                {s.caption}
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-6 text-xs text-slate-500">
          ※ 위 이미지는 샘플로, 실제 발급 양식과 다를 수 있습니다.
        </p>
      </div>
    </section>
  );
}

// ---------- FAQ ------------------------------------------------------------

function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  
  return (
    <section id="faq" className="bg-white py-24">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-12 text-center">
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
                className={`overflow-hidden rounded-2xl border transition-colors duration-300 ${isOpen ? 'border-[var(--color-accent)] bg-teal-50/30' : 'border-zinc-200 bg-white hover:border-zinc-300'}`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
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
                    <div className="whitespace-pre-line px-6 pb-6 pt-2 text-base leading-relaxed text-slate-600">
                      <span className="font-bold text-[var(--color-accent)] mr-2">A.</span>
                      {item.a}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------- footer ---------------------------------------------------------

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-[var(--color-primary)] pt-16 text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-12 md:grid-cols-12">
        <div className="space-y-6 md:col-span-5 lg:col-span-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-sans text-2xl font-extrabold tracking-tight text-white"
          >
            <ShieldCheck className="h-7 w-7 text-[var(--color-accent)]" />
            <span>KCPEC</span>
          </Link>
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
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row">
          <p className="text-sm text-slate-500">
            ⓒ {new Date().getFullYear()} 한국범죄예방교육센터. All rights reserved.
          </p>
          <div className="flex gap-4 text-sm text-slate-500">
            <Link href="#" className="hover:text-white transition-colors">이용약관</Link>
            <Link href="#" className="hover:text-white transition-colors font-medium">개인정보처리방침</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
