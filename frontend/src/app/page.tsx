"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCourses, logout, tokenStorage } from "@/lib/api";
import type { CourseListItem } from "@/types/course";

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "수료증은 언제 받을 수 있나요?",
    a: "강의 수강 완료 및 퀴즈 합격 후 즉시 발급 가능합니다.",
  },
  {
    q: "변호사 상담을 받을 수 있나요?",
    a: "본 센터는 변호사 소개·알선·상담을 제공하지 않습니다.",
  },
  {
    q: "환불이 가능한가요?",
    a: "결제 후 3일 이내, 수강 시작 전에 한해 전액 환불 가능합니다.",
  },
  {
    q: "상담 의견서는 어떻게 받나요?",
    a: "Standard/Premium 패키지 결제 후 설문 작성 시 전문가 검토를 거쳐 24시간 이내 이메일로 발송됩니다.",
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
    description: "이수증 + 양형자료 가이드",
    items: ["이수증", "양형자료 가이드"],
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
  const [authed, setAuthed] = useState(false);
  const [courses, setCourses] = useState<CourseListItem[]>([]);

  useEffect(() => {
    setAuthed(Boolean(tokenStorage.getAccess()));
    getCourses().then(setCourses).catch(() => setCourses([]));
  }, []);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Nav authed={authed} onLogout={() => { logout(); setAuthed(false); }} />
      <Hero />
      <TrustBar />
      <CoursesSection courses={courses} />
      <StepsSection />
      <PackagesSection />
      <FaqSection />
      <Footer />
    </div>
  );
}

// ---------- nav ------------------------------------------------------------

function Nav({ authed, onLogout }: { authed: boolean; onLogout: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="font-sans text-xl font-bold tracking-tight text-[var(--color-primary)]"
        >
          KCPEC
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-700 md:flex">
          <Link href="/courses" className="hover:text-[var(--color-primary)]">
            강의 목록
          </Link>
          <Link href="#guide" className="hover:text-[var(--color-primary)]">
            이용 안내
          </Link>
          <Link href="#faq" className="hover:text-[var(--color-primary)]">
            자주 묻는 질문
          </Link>
        </nav>
        <div className="flex items-center gap-2 text-sm">
          {authed ? (
            <>
              <Link
                href="/mypage"
                className="rounded px-3 py-1.5 font-medium text-zinc-700 hover:text-[var(--color-primary)]"
              >
                마이페이지
              </Link>
              <button
                type="button"
                onClick={onLogout}
                className="rounded border border-[var(--color-border)] px-3 py-1.5 hover:border-[var(--color-primary)]"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded px-3 py-1.5 font-medium text-zinc-700 hover:text-[var(--color-primary)]"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="rounded bg-[var(--color-primary)] px-4 py-1.5 font-medium text-white hover:bg-[var(--color-primary-hover)]"
              >
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ---------- hero -----------------------------------------------------------

function Hero() {
  return (
    <section
      className="relative overflow-hidden text-white"
      style={{
        background:
          "linear-gradient(135deg, #132448 0%, #1C3461 50%, #2A4B8D 100%)",
      }}
    >
      <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
        <span className="inline-block rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
          신뢰할 수 있는 재범방지 교육 플랫폼
        </span>
        <h1 className="mt-5 font-sans text-3xl font-bold leading-tight sm:text-5xl">
          재판 준비, 전문 교육으로 시작하세요
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
          법원이 인정하는 심리·준법 교육 수료증을 발급받고, 양형 자료로 활용하세요.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/courses"
            className="rounded bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            무료 수강 시작하기 →
          </Link>
          <Link
            href="#guide"
            className="rounded border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            이용 안내 보기
          </Link>
        </div>

        <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-8 text-sm">
          <HeroStat label="누적 수강생" value="10,000+" />
          <HeroStat label="교육 종류" value="11개 과정" />
          <HeroStat label="이수증 발급" value="당일 가능" />
        </dl>
      </div>
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-white/60">{label}</dt>
      <dd className="mt-1 font-sans text-xl font-bold sm:text-2xl">{value}</dd>
    </div>
  );
}

// ---------- trust bar ------------------------------------------------------

function TrustBar() {
  const items = [
    "전문가 감수 콘텐츠",
    "법원 양형 반영 사례",
    "수강 후 즉시 이수증",
    "개인정보 보호",
  ];
  return (
    <section className="border-y border-[var(--color-border)] bg-[var(--color-muted)]">
      <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 py-5 text-center text-xs font-medium text-zinc-700 sm:grid-cols-4 sm:text-sm">
        {items.map((t) => (
          <li key={t} className="flex items-center justify-center gap-2">
            <span className="text-[var(--color-accent)]">●</span>
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- courses --------------------------------------------------------

function CoursesSection({ courses }: { courses: CourseListItem[] }) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="font-sans text-2xl font-bold text-[var(--color-primary)] sm:text-3xl">
              교육 과정
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              수강은 무료, 수료증·심리상담 의견서는 별도 결제로 발급됩니다.
            </p>
          </div>
          <Link
            href="/courses"
            className="rounded border border-[var(--color-border)] px-4 py-2 text-sm hover:border-[var(--color-primary)]"
          >
            전체 강의 보기 →
          </Link>
        </div>
        {courses.length === 0 ? (
          <p className="rounded border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            강의 정보를 불러오는 중...
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.id}`}
                className="group flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="text-xs font-semibold text-[var(--color-accent)]">
                  {c.category}
                </span>
                <h3 className="font-sans text-lg font-semibold text-zinc-900 group-hover:text-[var(--color-primary)]">
                  {c.title}
                </h3>
                <div className="mt-auto flex items-center justify-between text-sm text-zinc-600">
                  <span>강의 무료 수강</span>
                  <span className="font-semibold text-[var(--color-primary)]">
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
    <section id="guide" className="bg-[var(--color-muted)]">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center font-sans text-2xl font-bold text-[var(--color-primary)] sm:text-3xl">
          이용 절차
        </h2>
        <ol className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="rounded-lg border border-[var(--color-border)] bg-white p-6"
            >
              <span className="font-sans text-2xl font-bold text-[var(--color-accent)]">
                {s.n}
              </span>
              <h3 className="mt-2 font-sans text-base font-semibold text-zinc-900">
                {s.title}
              </h3>
              <p className="mt-1 text-sm text-zinc-600">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------- packages -------------------------------------------------------

function PackagesSection() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center font-sans text-2xl font-bold text-[var(--color-primary)] sm:text-3xl">
          패키지
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-600">
          필요한 자료에 맞춰 선택하세요. 정확한 가격은 결제 단계에서 확인하실 수 있습니다.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PACKAGES.map((p) => (
            <div
              key={p.tier}
              className={`flex flex-col rounded-lg border-2 bg-white p-6 shadow-sm ${
                p.highlight
                  ? "border-[var(--color-primary)]"
                  : "border-[var(--color-border)]"
              }`}
            >
              <h3 className="font-sans text-xl font-bold text-[var(--color-primary)]">
                {p.tier}
              </h3>
              <p className="mt-1 text-sm text-zinc-600">{p.description}</p>
              <ul className="mt-5 space-y-2 text-sm text-zinc-700">
                {p.items.map((it) => (
                  <li key={it} className="flex items-center gap-2">
                    <span className="text-[var(--color-accent)]">✓</span>
                    {it}
                  </li>
                ))}
              </ul>
              <div className="mt-6 border-t border-[var(--color-border)] pt-4 text-center">
                <span className="text-sm text-zinc-500">결제 시 가격 확인</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- FAQ ------------------------------------------------------------

function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <section id="faq" className="bg-[var(--color-muted)]">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-center font-sans text-2xl font-bold text-[var(--color-primary)] sm:text-3xl">
          자주 묻는 질문
        </h2>
        <ul className="mt-8 space-y-2">
          {FAQ_ITEMS.map((item, idx) => {
            const open = openIdx === idx;
            return (
              <li
                key={item.q}
                className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-white"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : idx)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <span className="font-sans text-sm font-semibold text-zinc-900 sm:text-base">
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
                  <div className="border-t border-[var(--color-border)] bg-[var(--color-muted)]/50 px-5 py-4 text-sm leading-relaxed text-zinc-700">
                    A. {item.a}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ---------- footer ---------------------------------------------------------

function Footer() {
  return (
    <footer className="bg-[var(--color-primary)] text-white/80">
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm">
        <p className="font-sans text-base font-bold text-white">
          한국범죄예방교육센터
        </p>
        <p className="mt-2 text-xs text-white/60">
          상담문의 02-0000-0000 · 운영시간 평일 10:00 — 18:00
        </p>
        <p className="mt-6 text-xs text-white/50">
          ⓒ 2024 한국범죄예방교육센터. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
