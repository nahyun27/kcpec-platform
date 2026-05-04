"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCourses, logout, tokenStorage } from "@/lib/api";
import type { CourseListItem } from "@/types/course";

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
                  <div className="whitespace-pre-line border-t border-[var(--color-border)] bg-[var(--color-muted)]/50 px-5 py-4 text-sm leading-relaxed text-zinc-700">
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
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm md:grid-cols-2">
        <div className="space-y-1.5">
          <p className="font-sans text-base font-bold text-white">
            주식회사 한국범죄예방교육센터
          </p>
          <p className="text-xs text-white/70">대표자명: 윤승진</p>
          <p className="text-xs text-white/70">
            주소: 서울 강남구 언주로147길 42, 2층 2602호(논현동)
          </p>
          <p className="text-xs text-white/70">법인등록번호: 110111-8888525</p>
          <p className="text-xs text-white/70">법인사업자등록번호: 495-86-03325</p>
          <p className="text-xs text-white/70">
            통신판매업 신고번호: 제2024-서울강남-02655호
          </p>
          <p className="text-xs text-white/70">개인정보관리책임자: 윤승진</p>
        </div>
        <div className="space-y-1.5">
          <p className="font-sans text-base font-bold text-white">고객지원</p>
          <p className="text-xs text-white/70">
            상담문의:{" "}
            <a href="tel:01063773325" className="hover:text-white">
              010-6377-3325
            </a>
          </p>
          <p className="text-xs text-white/70">
            이메일:{" "}
            <a href="mailto:admin@kcpec.co.kr" className="hover:text-white">
              admin@kcpec.co.kr
            </a>
          </p>
          <p className="text-xs text-white/70">
            무통장 계좌: 기업은행 232-160450-04-015 (예금주: 한국범죄예방교육센터)
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-white/50">
          ⓒ 2024 한국범죄예방교육센터. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
