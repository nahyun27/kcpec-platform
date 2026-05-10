"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCourses } from "@/lib/api";
import { COURSE_CATEGORIES, type CourseCategory, type CourseListItem } from "@/types/course";
import { PageHeader } from "@/components/layout/PageHeader";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { GraduationCap, BookOpen, BadgeCheck } from "lucide-react";

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
    <div className="min-h-screen bg-slate-50/50 pb-24">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-200/60 pb-8 pt-12 shadow-sm relative z-10">
        <div className="mx-auto max-w-6xl px-6">
          <PageHeader
            title="교육 강의"
            subtitle="Courses"
            icon={<BookOpen className="h-3.5 w-3.5" />}
            description="전문가들이 감수한 심리·준법교육 과정을 전액 무료로 수강하실 수 있습니다. 원하시는 과정을 선택하고 바로 학습을 시작하세요."
          />

          <div className="flex flex-wrap items-center gap-3 pt-4">
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

      <div className="mx-auto max-w-6xl px-6 pt-12">
        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/50">
            <div className="flex flex-col items-center gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[var(--color-primary)]"></div>
              <p className="text-[15px] font-bold text-slate-500">강의 정보를 불러오는 중입니다...</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 py-16 text-center text-red-600 shadow-sm">
            <p className="text-lg font-bold">{error}</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white shadow-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
              <GraduationCap className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-xl font-bold text-slate-900">등록된 강의가 없습니다.</p>
            <p className="mt-2 text-[15px] font-medium text-slate-500">다른 카테고리를 선택해보세요.</p>
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
      className={`rounded-full px-5 py-2.5 text-[14px] font-bold transition-all duration-300 ${
        active
          ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/25 ring-1 ring-inset ring-[var(--color-primary)] scale-105"
          : "bg-white text-slate-600 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:ring-slate-300"
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
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-[var(--color-primary)]/10"
    >
      <div className="overflow-hidden">
        <div className="transition-transform duration-500 group-hover:scale-105">
          <CourseThumbnail category={course.category} title={course.title} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex w-fit items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold tracking-wide text-blue-700 ring-1 ring-inset ring-blue-600/20">
            {course.category}
          </span>
        </div>
        <h2 className="font-sans text-[17px] font-extrabold leading-snug text-slate-900 transition-colors group-hover:text-[var(--color-primary)] line-clamp-2">
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
