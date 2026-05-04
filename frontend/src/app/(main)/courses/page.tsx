"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCourses } from "@/lib/api";
import { COURSE_CATEGORIES, type CourseCategory, type CourseListItem } from "@/types/course";

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
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <h1 className="font-sans text-3xl font-bold text-[var(--color-primary)]">
          교육 강의
        </h1>
        <p className="text-sm text-zinc-600">
          심리·준법교육 강의는 무료로 수강할 수 있습니다.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
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

      {loading ? (
        <p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>
      ) : error ? (
        <p className="py-20 text-center text-sm text-red-600">{error}</p>
      ) : courses.length === 0 ? (
        <p className="py-20 text-center text-sm text-zinc-500">
          등록된 강의가 없습니다.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      )}
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
      className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
        active
          ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
          : "border-[var(--color-border)] bg-white text-zinc-700 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
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
      className="group flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-video w-full bg-zinc-100">
        {course.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-sans text-2xl text-zinc-400">
            KCPEC
          </div>
        )}
        <span className="absolute left-3 top-3 rounded bg-[var(--color-accent)] px-2 py-0.5 text-xs font-semibold text-white">
          강의 무료 수강
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-xs font-medium text-[var(--color-accent)]">
          {course.category}
        </span>
        <h2 className="font-sans text-lg font-semibold text-zinc-900 group-hover:text-[var(--color-primary)]">
          {course.title}
        </h2>
        <div className="mt-auto flex items-center justify-between text-sm">
          <span className="text-zinc-500">수료증 발급</span>
          <span className="font-semibold text-[var(--color-primary)]">
            {course.price.toLocaleString()}원~
          </span>
        </div>
      </div>
    </Link>
  );
}
