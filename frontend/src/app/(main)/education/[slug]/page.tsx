import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, MessageSquare, ShieldCheck } from "lucide-react";
import { CASE_LANDINGS, getCaseLanding } from "@/lib/caseLandings";
import type { CourseListItem } from "@/types/course";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

async function fetchCourses(): Promise<CourseListItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/courses`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export function generateStaticParams() {
  return CASE_LANDINGS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const landing = getCaseLanding(slug);
  if (!landing) return { title: "교육 안내 | KCPEC" };
  const title = `${landing.heading} 수료증 발급·양형자료 | KCPEC`;
  return {
    title,
    description: landing.intro,
    alternates: { canonical: `/education/${landing.slug}` },
    openGraph: { title, description: landing.intro },
  };
}

export default async function CaseLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const landing = getCaseLanding(slug);
  if (!landing) notFound();

  const courses = await fetchCourses();
  const matched = landing.courseTitles
    .map((t) => courses.find((c) => c.title === t))
    .filter((c): c is CourseListItem => c != null);

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0a1730] via-[var(--color-primary)] to-[#2A4B8D] px-6 pb-16 pt-28 text-white md:pb-24 md:pt-40 -mt-16 md:-mt-20">
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-200">
              법원·검찰 제출용 수료증
            </p>
          </div>
          <h1 className="mt-6 font-sans text-3xl font-extrabold tracking-tight sm:text-5xl">
            {landing.heading}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-300 sm:text-lg">
            {landing.intro}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sentencing"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[var(--color-primary)] shadow-lg transition-transform hover:-translate-y-0.5"
            >
              내 사건에 맞는 교육 추천 받기
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/mypage?tab=inquiry"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              <MessageSquare className="h-4 w-4" />
              1:1 문의
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14 md:py-20">
        <h2 className="font-sans text-xl font-extrabold text-slate-900 sm:text-2xl">
          이런 분께 필요한 교육이에요
        </h2>
        <ul className="mt-6 space-y-3">
          {landing.forWhom.map((line) => (
            <li key={line} className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]" />
              <span className="text-[15px] leading-relaxed text-slate-700">{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-slate-50 px-6 py-14 md:py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-sans text-xl font-extrabold text-slate-900 sm:text-2xl">
            {landing.name} 관련 교육 과정
          </h2>
          {matched.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">
              과정 정보를 불러오지 못했습니다.{" "}
              <Link href="/courses" className="font-semibold text-[var(--color-primary)] underline">
                전체 강의 보기
              </Link>
            </p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {matched.map((c) => (
                <Link
                  key={c.id}
                  href={`/courses/${c.id}`}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div>
                    <h3 className="font-sans text-lg font-bold text-slate-900">{c.title}</h3>
                    {c.description ? (
                      <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-slate-500">
                        {c.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-5 flex items-end justify-between">
                    <div>
                      {c.original_price && c.original_price > c.price ? (
                        <p className="text-xs text-slate-400 line-through">
                          {c.original_price.toLocaleString()}원
                        </p>
                      ) : null}
                      <p className="font-sans text-xl font-extrabold text-[var(--color-primary)]">
                        {c.price.toLocaleString()}원
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)]">
                      자세히 보기
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14 md:py-20">
        <h2 className="font-sans text-xl font-extrabold text-slate-900 sm:text-2xl">
          신청부터 수료증 발급까지
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ["1", "회원가입 후 교육 신청", "사건 유형에 맞는 과정을 선택하고 결제합니다."],
            ["2", "모바일·PC로 수강", "언제든 온라인으로 수강하고 퀴즈를 통과합니다."],
            ["3", "제출용 수료증 발급", "수료 후 수료증·서약서를 발급받아 제출합니다."],
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
        <p className="mt-6 text-xs leading-relaxed text-slate-400">
          수료증은 교육 이수를 증명하는 자료이며, 재판·수사 결과를 보장하지 않습니다. 양형자료의
          구성은 사건에 따라 달라질 수 있으니 1:1 문의로 상담해 주세요.
        </p>
      </section>

      <section className="border-t border-slate-100 bg-white px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
            다른 사건 유형 교육
          </p>
          <div className="flex flex-wrap gap-2">
            {CASE_LANDINGS.filter((c) => c.slug !== landing.slug).map((c) => (
              <Link
                key={c.slug}
                href={`/education/${c.slug}`}
                className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
