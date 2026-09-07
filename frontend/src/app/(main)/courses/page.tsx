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
  "분노 조절·감정 통제 교육": ["분노", "감정", "화", "폭발", "격분"],
  "알코올·중독 습관 교정 교육": ["알코올", "중독", "금주", "단주", "술"],
  "경제 관념·사행성 방지 교육": ["경제", "사행성", "낭비", "소비"],
  "생활예절교육": ["생활습관", "예절", "매너", "생활"],
  "비즈니스·직장 내 윤리 교육": ["직장", "괴롭힘", "갑질", "조직문화", "비즈니스"],
  "디지털 저작권·정보통신 윤리 교육": ["저작권", "정보통신", "불법다운로드", "디지털윤리"],
  "개인정보 보호·사이버 금융 범죄 예방": ["개인정보", "사이버금융", "유출", "해킹"],
  "보호자 양육 윤리·예방 교육": ["보호자", "양육", "아동학대", "훈육", "육아"],
  "공무원 윤리 교육": ["공무원", "공직", "청렴"],
  "단체·학교 내 윤리 교육": ["단체", "학교", "조직윤리"],
  "청소년범죄예방교육": ["청소년", "소년범", "미성년"],
  "폭력범죄 예방교육": ["폭력", "폭행", "상해"],
  "운전습관·도로교통법 교육": ["운전습관", "도로교통법", "난폭운전", "안전운전"],
  "명예훼손·모욕 예방 교육": ["명예훼손", "모욕", "악플", "비방"],
};

const MIN_QUERY_LEN = 2;

// 강의 전체보기 탭 — 사건 유형(카테고리)이 아니라 상품 구성 기준으로 분류.
// (예전엔 가격대만으로 3단으로 나눴는데, 33,000원대 안에 "특수 상황용"과
// "단체·직장용" 강의가 섞여 있어 가격만으로는 구분이 안 됐다. 강의명 기준
// 화이트리스트로 4단 분류.)
const COURSE_TIERS = [
  {
    key: "behavior",
    label: "행동 교정강의",
    titles: [
      "생활예절교육",
      "경제 관념·사행성 방지 교육",
      "알코올·중독 습관 교정 교육",
      "분노 조절·감정 통제 교육",
      "준법의식 강화",
    ],
  },
  {
    key: "basic",
    label: "기본 강의",
    titles: [
      "명예훼손·모욕 예방 교육",
      "운전습관·도로교통법 교육",
      "폭력범죄 예방교육",
      "청소년범죄예방교육",
      "학교폭력 예방",
      "스토킹범죄 예방",
      "사기횡령배임 등 재산범죄 예방",
      "피싱범죄 예방",
      "도박 및 도박개장 예방",
      "마약 예방",
      "디지털 성범죄 예방",
      "성매매 예방",
      "성범죄 예방",
      "음주운전 예방",
    ],
  },
  {
    key: "special",
    label: "특수강의",
    titles: [
      "공무원 윤리 교육",
      "보호자 양육 윤리·예방 교육",
      "개인정보 보호·사이버 금융 범죄 예방",
      "디지털 저작권·정보통신 윤리 교육",
    ],
  },
  {
    key: "group",
    label: "단체강의",
    titles: ["단체·학교 내 윤리 교육", "비즈니스·직장 내 윤리 교육"],
  },
] as const;

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
  // 상품 구성 탭 — 사건유형 카테고리와 별개 축.
  const [tierKey, setTierKey] = useState<(typeof COURSE_TIERS)[number]["key"] | null>(null);
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
  const activeTier = tierKey ? COURSE_TIERS.find((t) => t.key === tierKey) : null;
  const filteredCourses = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    return courses.filter((c) => {
      if (category && c.category !== category) return false;
      if (activeTier && !(activeTier.titles as readonly string[]).includes(c.title)) return false;
      if (!matchesQuery(c, q)) return false;
      return true;
    });
  }, [courses, category, activeTier, trimmedQuery]);

  // 2글자 미만이면 빈 결과여도 검색어로 표시하지 않음 (안내 없이 전체 표시)
  const isQueryActive = trimmedQuery.length >= MIN_QUERY_LEN;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24">
      {/* Page Header */}
      <div className="bg-white pt-10 md:pt-16 relative z-10 border-b border-slate-100">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <PageHeader
            title="교육 강의"
            subtitle="Courses"
            icon={<BookOpen className="h-3.5 w-3.5" />}
            description="전문가들이 감수한 심리·준법교육 과정입니다. 원하시는 과정을 선택하고 바로 학습을 시작하세요."
          />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 md:px-6 pt-8 md:pt-12 pb-12">
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
            <CategoryTab
              active={tierKey === null}
              onClick={() => {
                setTierKey(null);
                setCategory(null);
              }}
            >
              전체
            </CategoryTab>
            {COURSE_TIERS.map((t) => (
              <CategoryTab
                key={t.key}
                active={tierKey === t.key}
                onClick={() => {
                  setTierKey(t.key);
                  setCategory(null);
                }}
              >
                {t.label}
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
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-slate-200 hover:shadow-xl hover:shadow-slate-900/10"
    >
      {/* 실사 썸네일이라 이미지가 곧 시각적 정체성 — 중앙 텍스트 오버레이 없이
          이미지를 그대로 보여주고, 카테고리 배지만 이미지 위에 얹어 아래
          제목/가격 영역과 역할을 분리한다. */}
      <div className="relative overflow-hidden">
        <div className="transition-transform duration-500 ease-out group-hover:scale-[1.06]">
          <CourseThumbnail
            category={course.category}
            title={course.title}
            thumbnailUrl={course.thumbnail_url}
            eager={eager}
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/45 to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold tracking-wide text-slate-700 shadow-sm backdrop-blur-sm ring-1 ring-inset ring-black/5">
          {course.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 md:p-6">
        <h2 className="font-sans text-[15px] md:text-[17px] font-extrabold leading-snug text-slate-900 transition-colors group-hover:text-[var(--color-primary)] line-clamp-2">
          {course.title}
        </h2>
        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-slate-500">
            <BadgeCheck className="h-4 w-4 text-[var(--color-accent)]" />
            수료증 연계
          </span>
          <span className="flex items-baseline gap-1.5">
            {course.original_price != null && course.original_price > course.price ? (
              <span className="text-[12px] font-medium text-slate-400 line-through">
                {course.original_price.toLocaleString()}원
              </span>
            ) : null}
            <span className="text-[16px] md:text-[17px] font-extrabold text-[var(--color-primary)]">
              {course.price.toLocaleString()}원~
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
