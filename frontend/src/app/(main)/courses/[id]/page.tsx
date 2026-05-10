"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import {
  enrollCourse,
  getCourseDetail,
  getCourseProgress,
  getCourseReviews,
  tokenStorage,
} from "@/lib/api";
import type { CourseDetail, CourseReview } from "@/types/course";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  FileText,
  MessageSquare,
  PlayCircle,
} from "lucide-react";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s.toString().padStart(2, "0")}초`;
}

function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
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
  // null = 미확정 (로딩 또는 비로그인 판정 전)
  const [isEnrolled, setIsEnrolled] = useState<boolean | null>(null);
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [expandedReviews, setExpandedReviews] = useState<Set<number>>(new Set());
  const [sidebarFlash, setSidebarFlash] = useState(false);
  const sidebarRef = useRef<HTMLDivElement | null>(null);

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

  // 후기 — 로그인 여부 무관 공개 조회.
  useEffect(() => {
    let cancelled = false;
    getCourseReviews(courseId)
      .then((data) => {
        if (!cancelled) setReviews(data);
      })
      .catch(() => {
        /* 후기 로드 실패는 전체 페이지를 막지 않음 — 빈 배열로 노출 */
      })
      .finally(() => {
        if (!cancelled) setReviewsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  // 수강 등록 여부 — 비로그인이면 false, 로그인 + 미등록(404)도 false.
  useEffect(() => {
    let cancelled = false;
    if (!tokenStorage.getAccess()) {
      setIsEnrolled(false);
      return;
    }
    getCourseProgress(courseId)
      .then(() => {
        if (!cancelled) setIsEnrolled(true);
      })
      .catch(() => {
        if (!cancelled) setIsEnrolled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  function handlePlayClick() {
    // 비로그인 → 로그인 페이지로 (next 으로 복귀 경로 보존)
    if (!tokenStorage.getAccess()) {
      router.push(`/login?next=/courses/${courseId}`);
      return;
    }
    // 등록 상태 미확정이면 안전하게 사이드바 강조 (네트워크 race)
    if (isEnrolled) {
      router.push(`/courses/${courseId}/watch`);
      return;
    }
    sidebarRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setSidebarFlash(true);
    setTimeout(() => setSidebarFlash(false), 1500);
  }

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

  function toggleReview(id: number) {
    setExpandedReviews((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-[var(--color-accent)]"></div>
          <p className="text-sm font-medium text-zinc-500">불러오는 중...</p>
        </div>
      </div>
    );
  }
  if (error || !course) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-600 shadow-sm">
          <p className="text-lg font-semibold">{error ?? "강의를 찾을 수 없습니다."}</p>
          <Link href="/courses" className="mt-4 inline-block font-medium underline underline-offset-4 hover:text-red-800">
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const totalDuration = course.lectures.reduce((acc, l) => acc + l.duration_seconds, 0);

  return (
    <div className="min-h-screen pb-24">
      {/* Top Navigation Bar */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[var(--color-primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            목록으로 돌아가기
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 pt-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          
          {/* Main Content (Left) */}
          <div className="lg:col-span-2 space-y-10">
            {/* Header Section */}
            <div className="space-y-4">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold tracking-wide text-[var(--color-accent)] ring-1 ring-blue-500/20">
                {course.category}
              </span>
              <h1 className="font-sans text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">
                {course.title}
              </h1>
              <p className="whitespace-pre-wrap text-lg leading-relaxed text-slate-600">
                {course.description ?? "— 자세한 설명은 추후 업데이트됩니다."}
              </p>
            </div>

            {/* Video Thumbnail */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200 shadow-sm">
              <CourseThumbnail category={course.category}>
                <div
                  className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors hover:bg-black/20 group cursor-pointer"
                  onClick={handlePlayClick}
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-xl backdrop-blur-sm transition-transform group-hover:scale-110">
                    <PlayCircle className="h-8 w-8 text-[var(--color-primary)]" />
                  </div>
                </div>
              </CourseThumbnail>
            </div>

            {/* Curriculum Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-2 border-b border-zinc-200 pb-4">
                <BookOpen className="h-6 w-6 text-[var(--color-primary)]" />
                <h2 className="font-sans text-2xl font-bold text-slate-900">
                  커리큘럼
                </h2>
              </div>
              <ol className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                {course.lectures.map((lec, idx) => (
                  <li key={lec.id} className="group flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5 last:border-none transition-colors hover:bg-slate-50">
                    <div className="flex items-center gap-5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 font-sans text-sm font-bold text-slate-400 group-hover:bg-blue-50 group-hover:text-[var(--color-accent)] transition-colors">
                        {String(idx + 1).padStart(2, "0")}
                      </div>
                      <span className="text-base font-semibold text-slate-800 group-hover:text-slate-900">{lec.title}</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
                      <Clock className="h-4 w-4" />
                      {formatDuration(lec.duration_seconds)}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {/* Reviews Section */}
            <section className="space-y-6">
              <div className="flex items-center justify-between gap-2 border-b border-zinc-200 pb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-6 w-6 text-[var(--color-primary)]" />
                  <h2 className="font-sans text-2xl font-bold text-slate-900">
                    수강 후기
                  </h2>
                  {reviewsLoaded && reviews.length > 0 ? (
                    <span className="text-sm font-medium text-slate-500">
                      ({reviews.length}개)
                    </span>
                  ) : null}
                </div>
                <Link
                  href="/community?tab=review"
                  className="text-sm font-semibold text-[var(--color-primary)] hover:underline"
                >
                  후기 작성하기 →
                </Link>
              </div>
              {!reviewsLoaded ? (
                <p className="rounded-2xl border border-dashed border-zinc-200 bg-white py-10 text-center text-sm text-slate-400">
                  불러오는 중...
                </p>
              ) : reviews.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50 py-10 text-center text-slate-500">
                  <MessageSquare className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
                  <p className="font-medium">아직 등록된 후기가 없습니다.</p>
                  <p className="mt-1 text-xs text-slate-400">첫 후기를 남겨보세요.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {reviews.map((r) => {
                    const expanded = expandedReviews.has(r.id);
                    return (
                      <li
                        key={r.id}
                        className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                      >
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-bold text-slate-800">
                            {r.author_name}
                          </span>
                          <span className="text-xs font-medium text-slate-400">
                            {formatReviewDate(r.created_at)}
                          </span>
                        </div>
                        <p
                          className={`whitespace-pre-wrap text-sm leading-relaxed text-slate-600 ${
                            expanded ? "" : "line-clamp-3"
                          }`}
                        >
                          {r.content}
                        </p>
                        {r.content.length > 120 ? (
                          <button
                            type="button"
                            onClick={() => toggleReview(r.id)}
                            className="mt-2 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                          >
                            {expanded ? "접기" : "더보기"}
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Sticky Sidebar (Right) */}
          <div className="lg:col-span-1">
            <div
              ref={sidebarRef}
              className={`sticky top-24 rounded-3xl border bg-white p-6 shadow-xl shadow-slate-200/50 transition-all duration-500 ${
                sidebarFlash
                  ? "border-[var(--color-primary)] ring-4 ring-[var(--color-primary)]/30"
                  : "border-zinc-200"
              }`}
            >
              <h3 className="font-sans text-lg font-bold text-slate-900 mb-6">강의 정보</h3>
              
              <div className="space-y-4 mb-8">
                <Stat icon={<BookOpen className="h-5 w-5" />} label="총 강의 수" value={`${course.lectures.length}강`} />
                <Stat icon={<Clock className="h-5 w-5" />} label="총 학습 시간" value={formatDuration(totalDuration)} />
                <Stat icon={<FileText className="h-5 w-5" />} label="수료증 발급 패키지" value={`${course.price.toLocaleString()}원~`} highlight />
              </div>

              <div className="rounded-xl bg-slate-50 p-4 mb-6 border border-slate-100">
                <p className="text-sm text-slate-600 leading-relaxed text-center">
                  강의 수강은 <strong className="text-slate-900">전액 무료</strong>입니다. <br/>
                  수료증 및 양형자료는 수강 완료 후 결제를 통해 발급받으실 수 있습니다.
                </p>
              </div>

              <button
                type="button"
                onClick={handleStart}
                disabled={enrolling}
                className="w-full rounded-xl bg-[var(--color-primary)] py-4 font-bold text-white shadow-md shadow-[var(--color-primary)]/20 transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] hover:shadow-lg hover:shadow-[var(--color-primary)]/30 disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {enrolling ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    등록 중...
                  </span>
                ) : (
                  "무료 수강 시작하기"
                )}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, highlight = false }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2.5 text-slate-500">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className={`font-bold ${highlight ? 'text-[var(--color-primary)] text-base' : 'text-slate-900'}`}>{value}</span>
    </div>
  );
}
