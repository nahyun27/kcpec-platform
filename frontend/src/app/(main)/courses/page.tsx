"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCourses } from "@/lib/api";
import { COURSE_CATEGORIES, type CourseCategory, type CourseListItem } from "@/types/course";
import { PlayCircle, GraduationCap } from "lucide-react";

export default function CoursesListPage() {
  const [category, setCategory] = useState<CourseCategory | null>(null);
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCourses(category ?? undefined)
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
  }, [category]);

  return (
    <div className="min-h-[80vh] pb-24">
      {/* Page Header */}
      <div className="bg-gradient-to-b from-white to-[var(--color-muted)] pb-8 pt-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-10 max-w-2xl">
            <h1 className="font-sans text-3xl font-extrabold tracking-tight text-[var(--color-primary)] sm:text-4xl md:text-5xl">
              교육 강의
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              전문가들이 감수한 심리·준법교육 과정을 전액 무료로 수강하실 수 있습니다. 
              원하시는 과정을 선택하고 바로 학습을 시작하세요.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <CategoryTab active={category === null} onClick={() => setCategory(null)}>
              전체 보기
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
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-10">
        {loading ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-8 text-center text-zinc-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-[var(--color-accent)]"></div>
            <p className="mt-4 font-medium">강의 정보를 불러오는 중입니다...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 py-12 text-center text-red-600 shadow-sm">
            <p className="font-semibold">{error}</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white py-24 text-center text-zinc-500 shadow-sm">
            <GraduationCap className="mb-4 h-12 w-12 text-zinc-300" />
            <p className="text-lg font-medium">등록된 강의가 없습니다.</p>
            <p className="mt-1 text-sm text-zinc-400">다른 카테고리를 선택해보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <CourseCard key={c.id} course={c} />
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
      className={`rounded-full px-5 py-2 text-sm font-semibold transition-all duration-300 ${
        active
          ? "bg-[var(--color-primary)] text-white shadow-md shadow-slate-900/20"
          : "bg-white text-zinc-600 shadow-sm border border-zinc-200 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

function CourseCard({ course }: { course: CourseListItem }) {
  return (
    <Link
      href={`/courses/${course.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-[var(--color-primary)]/10"
    >
      <div className="relative aspect-video w-full bg-slate-100 overflow-hidden">
        {course.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 font-sans text-3xl font-bold tracking-tight text-slate-300">
            KCPEC
          </div>
        )}
        {/* Subtle overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-80"></div>
        <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/90 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm shadow-sm">
          <PlayCircle className="h-3 w-3" />
          무료 수강
        </span>
      </div>
      
      <div className="flex flex-1 flex-col gap-3 p-6">
        <span className="text-xs font-bold tracking-wider text-[var(--color-accent)]">
          {course.category}
        </span>
        <h2 className="font-sans text-xl font-bold leading-snug text-slate-900 group-hover:text-[var(--color-primary)] transition-colors line-clamp-2">
          {course.title}
        </h2>
        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
          <span className="font-medium text-slate-500">수료증 발급 가능</span>
          <span className="font-bold text-[var(--color-primary)]">
            {course.price.toLocaleString()}원~
          </span>
        </div>
      </div>
    </Link>
  );
}
