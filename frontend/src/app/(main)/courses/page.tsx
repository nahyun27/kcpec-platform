"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { getCourses } from "@/lib/api";
import { COURSE_CATEGORIES, type CourseCategory, type CourseListItem } from "@/types/course";
import { PageHeader } from "@/components/layout/PageHeader";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { Spinner } from "@/components/ui/Spinner";
import { GraduationCap, BookOpen, BadgeCheck, Search } from "lucide-react";

// 강의 제목 → 검색 키워드 사전. 카테고리 통합 후에도 강의 제목은
// 변하지 않으므로 그대로 키로 사용한다. 키워드는 모두 lowercase 비교.
const COURSE_KEYWORDS: Record<string, string[]> = {
  "음주운전 예방": ["음주", "음주운전", "교통", "DUI", "술", "운전", "면허취소"],
  "성범죄 예방": ["성범죄", "성폭력", "강간", "추행", "강제"],
  "성매매 예방": ["성매매", "원조교제", "조건만남"],
  "디지털 성범죄 예방": ["디지털", "불법촬영", "몰카", "n번방", "딥페이크", "사이버"],
  "마약 예방": ["마약", "필로폰", "대마", "약물", "마약류"],
  "도박 및 도박개장 예방": ["도박", "불법도박", "카지노", "배팅", "사설"],
  "피싱범죄 예방": [
    "피싱", "보이스피싱", "보이스", "스미싱", "파밍", "사기전화", "전화사기",
  ],
  "사기횡령배임 등 재산범죄 예방": ["사기", "횡령", "배임", "재산", "편취"],
  "스토킹범죄 예방": ["스토킹", "접근금지", "따라다님", "집착"],
  "학교폭력 예방": ["학교폭력", "따돌림", "왕따", "집단폭행", "교내"],
  "준법의식 강화": ["준법", "법의식", "법교육", "법준수"],
};

const MIN_QUERY_LEN = 2;

function matchesQuery(course: CourseListItem, q: string): boolean {
  if (q.length < MIN_QUERY_LEN) return true;
  if (course.title.toLowerCase().includes(q)) return true;
  if (course.description && course.description.toLowerCase().includes(q)) return true;
  const keywords = COURSE_KEYWORDS[course.title];
  if (!keywords) return false;
  for (const kw of keywords) {
    const k = kw.toLowerCase();
    // 1) 키워드가 검색어를 포함  (예: q="음주" ⊂ kw="음주운전")
    if (k.includes(q)) return true;
    // 2) 검색어가 키워드의 앞 2글자를 포함 (예: q="보이스피싱" ⊃ kw[:2]="보이")
    if (k.length >= 2 && q.includes(k.slice(0, 2))) return true;
  }
  return false;
}

export default function CoursesListPage() {
  return (
    <Suspense fallback={null}>
      <CoursesListInner />
    </Suspense>
  );
}

function CoursesListInner() {
  const searchParams = useSearchParams();
  // ?category= 가 유효한 카테고리면 초기 필터로 사용 (CurationModal → 라우팅)
  const initialCategory = (() => {
    const raw = searchParams.get("category");
    if (raw && (COURSE_CATEGORIES as readonly string[]).includes(raw)) {
      return raw as CourseCategory;
    }
    return null;
  })();

  const [category, setCategory] = useState<CourseCategory | null>(initialCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 전체 목록을 한 번만 받아서 카테고리/검색을 클라이언트에서 합성.
  // (강의 수가 수십 개 수준이라 매 입력마다 API 를 부르는 비용이 더 큼)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCourses()
      .then((data) => {
        if (!cancelled) setCourses(data);
      })
      .catch(() => {
        if (!cancelled) setError("강의 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const trimmedQuery = searchQuery.trim();
  const filteredCourses = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    return courses.filter((c) => {
      if (category && c.category !== category) return false;
      if (!matchesQuery(c, q)) return false;
      return true;
    });
  }, [courses, category, trimmedQuery]);

  // 2글자 미만이면 빈 결과여도 검색어로 표시하지 않음 (안내 없이 전체 표시)
  const isQueryActive = trimmedQuery.length >= MIN_QUERY_LEN;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24">
      {/* Page Header */}
      <div className="bg-white pt-12 relative z-10">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <PageHeader
            title="교육 강의"
            subtitle="Courses"
            icon={<BookOpen className="h-3.5 w-3.5" />}
            description="전문가들이 감수한 심리·준법교육 과정입니다. 원하시는 과정을 선택하고 바로 학습을 시작하세요."
          />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 md:px-6 pt-0 pb-12">
        {/* Controls: Search & Filter */}
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="강의명으로 검색하세요"
              className="w-full rounded-2xl border-none bg-white py-3.5 pl-11 pr-5 text-[15px] text-slate-800 placeholder:text-slate-400 shadow-md shadow-slate-200/50 transition-all hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 md:gap-2.5">
            <CategoryTab active={category === null} onClick={() => setCategory(null)}>
              전체
            </CategoryTab>
            {COURSE_CATEGORIES.map((c) => (
              <CategoryTab
                key={c}
                active={category === c}
                onClick={() => setCategory(c)}
              >
                {c}
              </CategoryTab>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/50">
            <div className="flex flex-col items-center gap-4">
              <Spinner size="md" tone="primary" />
              <p className="text-[15px] font-bold text-slate-500">강의 정보를 불러오는 중입니다...</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 py-16 text-center text-red-600 shadow-sm">
            <p className="text-lg font-bold">{error}</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white shadow-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
              {isQueryActive ? (
                <Search className="h-8 w-8 text-slate-300" />
              ) : (
                <GraduationCap className="h-8 w-8 text-slate-300" />
              )}
            </div>
            {isQueryActive ? (
              <>
                <p className="text-xl font-bold text-slate-900">
                  &lsquo;{trimmedQuery}&rsquo;에 대한 결과가 없습니다.
                </p>
                <p className="mt-2 text-[15px] font-medium text-slate-500">
                  다른 키워드로 검색해보세요.
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold text-slate-900">등록된 강의가 없습니다.</p>
                <p className="mt-2 text-[15px] font-medium text-slate-500">다른 카테고리를 선택해보세요.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((c, idx) => (
              <CourseCard key={c.id} course={c} eager={idx < 3} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs md:px-5 md:py-2.5 md:text-[14px] font-bold transition-all duration-300 ${
        active
          ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/25 ring-1 ring-inset ring-[var(--color-primary)] scale-105"
          : "bg-white text-slate-600 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:ring-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function CourseCard({ course, eager = false }: { course: CourseListItem; eager?: boolean }) {
  return (
    <Link
      href={`/courses/${course.id}`}
      prefetch
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-[var(--color-primary)]/10"
    >
      <div className="overflow-hidden">
        <div className="transition-transform duration-500 group-hover:scale-105">
          <CourseThumbnail
            category={course.category}
            title={course.title}
            showTitle
            eager={eager}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3 md:p-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex w-fit items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold tracking-wide text-blue-700 ring-1 ring-inset ring-blue-600/20">
            {course.category}
          </span>
        </div>
        <h2 className="font-sans text-sm md:text-[17px] font-extrabold leading-snug text-slate-900 transition-colors group-hover:text-[var(--color-primary)] line-clamp-2">
          {course.title}
        </h2>
        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-5 text-sm">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-slate-500">
            <BadgeCheck className="h-4 w-4 text-[var(--color-accent)]" />
            수료증 연계
          </span>
          <span className="text-[15px] font-extrabold text-[var(--color-primary)]">
            {course.price.toLocaleString()}원~
          </span>
        </div>
      </div>
    </Link>
  );
}
