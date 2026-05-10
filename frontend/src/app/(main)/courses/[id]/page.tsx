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
    <div className="min-h-screen bg-slate-50/50 pb-24">
      {/* Top Navigation Bar */}
      <div className="border-b border-slate-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-[var(--color-primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            강의 목록
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <section className="bg-white border-b border-slate-200/60 pt-10 pb-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold tracking-wide text-blue-700 ring-1 ring-inset ring-blue-600/20">
                {course.category}
              </span>
              <h1 className="font-sans text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl lg:text-5xl lg:leading-[1.15]">
                {course.title}
              </h1>
              <p className="whitespace-pre-wrap text-lg leading-relaxed text-slate-600 max-w-xl">
                {course.description ?? "— 자세한 설명은 추후 업데이트됩니다."}
              </p>
              <div className="flex flex-wrap items-center gap-6 pt-4 text-sm font-medium text-slate-600">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <span>총 {course.lectures.length}강</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <Clock className="h-5 w-5" />
                  </div>
                  <span>{formatDuration(totalDuration)}</span>
                </div>
              </div>
            </div>

            {/* Video Thumbnail */}
            <div className="relative mx-auto w-full max-w-lg lg:ml-auto lg:mr-0">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-[var(--color-primary)]/20 to-transparent blur-2xl"></div>
              <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-2xl">
                <CourseThumbnail category={course.category}>
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/20 transition-all hover:bg-black/30 group cursor-pointer"
                    onClick={handlePlayClick}
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/95 shadow-xl backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
                      <PlayCircle className="h-10 w-10 text-[var(--color-primary)] ml-1" />
                    </div>
                  </div>
                </CourseThumbnail>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-6 pt-12">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          
          <div className="lg:col-span-2 space-y-16">
            
            {/* Curriculum Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h2 className="font-sans text-2xl font-extrabold text-slate-900">
                  커리큘럼
                </h2>
              </div>
              <ol className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
                {course.lectures.map((lec, idx) => (
                  <li key={lec.id} className="group flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5 last:border-none transition-colors hover:bg-slate-50/80">
                    <div className="flex items-center gap-5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-sm font-bold text-slate-400 ring-1 ring-inset ring-slate-200 group-hover:bg-[var(--color-primary)]/5 group-hover:text-[var(--color-primary)] group-hover:ring-[var(--color-primary)]/20 transition-all">
                        {String(idx + 1).padStart(2, "0")}
                      </div>
                      <span className="text-[15px] font-bold text-slate-700 group-hover:text-slate-900">{lec.title}</span>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-[13px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDuration(lec.duration_seconds)}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {/* Reviews Section */}
            <section className="space-y-6">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <h2 className="font-sans text-2xl font-extrabold text-slate-900">
                    수강 후기
                  </h2>
                  {reviewsLoaded && reviews.length > 0 ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                      {reviews.length}
                    </span>
                  ) : null}
                </div>
                <Link
                  href="/community?tab=review"
                  className="rounded-full bg-white px-4 py-2 text-[13px] font-bold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-50"
                >
                  후기 작성하기
                </Link>
              </div>
              
              {!reviewsLoaded ? (
                <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/50 py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[var(--color-primary)]"></div>
                </div>
              ) : reviews.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500 shadow-sm">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50">
                    <MessageSquare className="h-7 w-7 text-slate-300" />
                  </div>
                  <p className="font-semibold text-slate-900">아직 등록된 후기가 없습니다.</p>
                  <p className="mt-1 text-sm text-slate-500">이 강의의 첫 번째 수강 후기를 남겨보세요.</p>
                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  {reviews.map((r) => {
                    const expanded = expandedReviews.has(r.id);
                    return (
                      <li
                        key={r.id}
                        className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)]/10 font-bold text-[var(--color-primary)]">
                              {r.author_name.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-900">
                              {r.author_name}
                            </span>
                          </div>
                          <span className="text-[13px] font-medium text-slate-400">
                            {formatReviewDate(r.created_at)}
                          </span>
                        </div>
                        <p
                          className={`whitespace-pre-wrap text-[15px] leading-relaxed text-slate-600 ${
                            expanded ? "" : "line-clamp-3"
                          }`}
                        >
                          {r.content}
                        </p>
                        {r.content.length > 120 ? (
                          <button
                            type="button"
                            onClick={() => toggleReview(r.id)}
                            className="mt-3 text-[13px] font-bold text-[var(--color-primary)] hover:underline"
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
              className={`sticky top-28 overflow-hidden rounded-3xl border bg-white shadow-xl shadow-slate-200/50 transition-all duration-500 ${
                sidebarFlash
                  ? "border-[var(--color-primary)] ring-4 ring-[var(--color-primary)]/20 scale-[1.02]"
                  : "border-slate-200/60"
              }`}
            >
              <div className="bg-slate-50/50 p-6 border-b border-slate-100">
                <h3 className="font-sans text-xl font-extrabold text-slate-900 mb-2">무료 수강 신청</h3>
                <p className="text-[13px] font-medium text-slate-500">강의 수강은 전액 무료입니다.</p>
              </div>
              
              <div className="p-6">
                <div className="space-y-4 mb-8">
                  <Stat icon={<BookOpen className="h-5 w-5" />} label="총 강의 수" value={`${course.lectures.length}강`} />
                  <Stat icon={<Clock className="h-5 w-5" />} label="총 학습 시간" value={formatDuration(totalDuration)} />
                  <div className="my-4 h-px w-full bg-slate-100"></div>
                  <Stat icon={<FileText className="h-5 w-5" />} label="수료증 연계 가능" value={`${course.price.toLocaleString()}원~`} highlight />
                  <p className="text-[11px] font-medium text-slate-400 mt-1 pl-7">
                    * 수료증 및 양형자료는 수강 완료 후 결제를 통해 발급받으실 수 있습니다.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleStart}
                  disabled={enrolling}
                  className="group relative flex w-full items-center justify-center overflow-hidden rounded-2xl bg-[var(--color-primary)] px-8 py-4 font-bold text-white shadow-lg shadow-[var(--color-primary)]/25 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-[var(--color-primary)]/40 disabled:pointer-events-none disabled:opacity-60"
                >
                  <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-150%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(150%)]">
                    <div className="relative h-full w-8 bg-white/20"></div>
                  </div>
                  {enrolling ? (
                    <span className="flex items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                      등록 중...
                    </span>
                  ) : (
                    <span className="text-[15px]">수강 시작하기</span>
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, highlight = false }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-3 text-slate-500">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200/60">
          {icon}
        </div>
        <span className="text-[14px] font-semibold">{label}</span>
      </div>
      <span className={`font-bold tracking-tight ${highlight ? 'text-[var(--color-primary)] text-lg' : 'text-slate-900 text-base'}`}>{value}</span>
    </div>
  );
}
