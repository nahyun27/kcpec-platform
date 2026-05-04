"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { enrollCourse, getCourseDetail, tokenStorage } from "@/lib/api";
import type { CourseDetail } from "@/types/course";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s.toString().padStart(2, "0")}초`;
}

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const courseId = Number(id);
  const router = useRouter();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCourseDetail(courseId)
      .then((data) => {
        if (!cancelled) setCourse(data);
      })
      .catch(() => {
        if (!cancelled) setError("강의 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function handleStart() {
    if (!tokenStorage.getAccess()) {
      router.push(`/login?next=/courses/${courseId}`);
      return;
    }
    setEnrolling(true);
    try {
      await enrollCourse(courseId);
      router.push(`/courses/${courseId}/watch`);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      alert(detail ?? "수강 등록에 실패했습니다.");
    } finally {
      setEnrolling(false);
    }
  }

  if (loading) {
    return <p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>;
  }
  if (error || !course) {
    return <p className="py-20 text-center text-sm text-red-600">{error ?? "강의를 찾을 수 없습니다."}</p>;
  }

  const totalDuration = course.lectures.reduce((acc, l) => acc + l.duration_seconds, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href="/courses"
        className="mb-4 inline-block text-sm text-zinc-500 hover:text-[var(--color-primary)]"
      >
        ← 강의 목록
      </Link>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-white">
        <div className="aspect-video w-full bg-zinc-100">
          {course.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.thumbnail_url}
              alt={course.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-serif text-3xl text-zinc-400">
              KCPEC
            </div>
          )}
        </div>

        <div className="space-y-4 p-6">
          <span className="inline-block rounded bg-[var(--color-accent)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--color-accent)]">
            {course.category}
          </span>
          <h1 className="font-serif text-3xl font-bold text-[var(--color-primary)]">
            {course.title}
          </h1>
          {course.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700">
              {course.description}
            </p>
          ) : null}

          <div className="grid grid-cols-3 gap-3 rounded border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-center text-sm">
            <Stat label="총 강의" value={`${course.lectures.length}강`} />
            <Stat label="총 시간" value={formatDuration(totalDuration)} />
            <Stat label="수료증" value={`${course.price.toLocaleString()}원`} />
          </div>

          <button
            type="button"
            onClick={handleStart}
            disabled={enrolling}
            className="w-full rounded bg-[var(--color-primary)] py-3 font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {enrolling ? "이동 중..." : "수강 시작하기 (무료)"}
          </button>
        </div>
      </div>

      <section className="mt-8 space-y-3">
        <h2 className="font-serif text-xl font-bold text-[var(--color-primary)]">
          커리큘럼
        </h2>
        <ol className="divide-y divide-[var(--color-border)] overflow-hidden rounded-lg border border-[var(--color-border)] bg-white">
          {course.lectures.map((lec, idx) => (
            <li key={lec.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-4">
                <span className="font-serif text-lg text-[var(--color-accent)]">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-medium text-zinc-900">{lec.title}</span>
              </div>
              <span className="text-xs text-zinc-500">{formatDuration(lec.duration_seconds)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
