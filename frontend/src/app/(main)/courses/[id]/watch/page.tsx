"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isAxiosError } from "axios";
import {
  enrollCourse,
  getCourseDetail,
  getCourseProgress,
  getStreamUrl,
  updateLectureProgress,
} from "@/lib/api";
import type {
  CourseDetail,
  EnrollmentStatus,
  LectureItem,
} from "@/types/course";

const PROGRESS_INTERVAL_MS = 10_000;

export default function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const courseId = Number(id);
  const router = useRouter();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [status, setStatus] = useState<EnrollmentStatus | null>(null);
  const [activeLectureId, setActiveLectureId] = useState<number | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const watchedSecondsRef = useRef(0);

  // 1) Initial load: course + ensure enrollment + progress.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const detail = await getCourseDetail(courseId);
        if (cancelled) return;
        setCourse(detail);

        let st: EnrollmentStatus;
        try {
          st = await getCourseProgress(courseId);
        } catch (err) {
          if (isAxiosError(err) && err.response?.status === 404) {
            st = await enrollCourse(courseId);
          } else if (isAxiosError(err) && err.response?.status === 401) {
            router.push(`/login?next=/courses/${courseId}/watch`);
            return;
          } else {
            throw err;
          }
        }
        if (cancelled) return;
        setStatus(st);

        const firstIncomplete =
          detail.lectures.find(
            (lec) => !st.lecture_progresses.find((p) => p.lecture_id === lec.id)?.is_completed,
          ) ?? detail.lectures[0];
        if (firstIncomplete) setActiveLectureId(firstIncomplete.id);
      } catch {
        if (!cancelled) setError("강의를 불러오지 못했습니다.");
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [courseId, router]);

  // 2) Whenever the active lecture changes, fetch a fresh stream URL and
  //    seed the watched-seconds counter from the saved progress.
  useEffect(() => {
    if (activeLectureId == null) return;
    let cancelled = false;
    setStreamUrl(null);
    const saved = status?.lecture_progresses.find((p) => p.lecture_id === activeLectureId);
    watchedSecondsRef.current = saved?.watched_seconds ?? 0;

    getStreamUrl(activeLectureId)
      .then((res) => {
        if (!cancelled) setStreamUrl(res.url);
      })
      .catch(() => {
        if (!cancelled) setError("재생 URL을 발급받지 못했습니다.");
      });

    return () => {
      cancelled = true;
    };
    // status intentionally excluded — we only want to reseed on lecture change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLectureId]);

  // 3) Heartbeat: every 10s, if the video is playing, push progress.
  const sendProgress = useCallback(
    async (overrides?: { is_completed?: boolean }) => {
      if (activeLectureId == null) return;
      const video = videoRef.current;
      const last = video ? Math.floor(video.currentTime) : 0;
      try {
        const next = await updateLectureProgress(activeLectureId, {
          watched_seconds: watchedSecondsRef.current,
          last_position_sec: last,
          is_completed: overrides?.is_completed ?? false,
        });
        setStatus(next);
      } catch {
        /* swallow — best-effort heartbeat */
      }
    },
    [activeLectureId],
  );

  useEffect(() => {
    if (activeLectureId == null) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended) return;
      watchedSecondsRef.current += PROGRESS_INTERVAL_MS / 1000;
      void sendProgress();
    }, PROGRESS_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeLectureId, sendProgress]);

  // 4) On video metadata load, restore last position.
  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video || activeLectureId == null) return;
    const saved = status?.lecture_progresses.find((p) => p.lecture_id === activeLectureId);
    if (saved && saved.last_position_sec > 0 && saved.last_position_sec < video.duration) {
      video.currentTime = saved.last_position_sec;
    }
  }

  function handleEnded() {
    void sendProgress({ is_completed: true });
  }

  const completedIds = useMemo(
    () =>
      new Set(
        status?.lecture_progresses.filter((p) => p.is_completed).map((p) => p.lecture_id) ?? [],
      ),
    [status],
  );

  const allLecturesDone =
    course != null && course.lectures.length > 0 && course.lectures.every((l) => completedIds.has(l.id));

  if (error) {
    return <p className="py-20 text-center text-sm text-red-600">{error}</p>;
  }
  if (!course || !status) {
    return <p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link
        href={`/courses/${courseId}`}
        className="mb-4 inline-block text-sm text-zinc-500 hover:text-[var(--color-primary)]"
      >
        ← 강의 상세
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
            {streamUrl ? (
              <video
                key={streamUrl}
                ref={videoRef}
                src={streamUrl}
                controls
                className="h-full w-full"
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
              >
                동영상을 재생할 수 없습니다.
              </video>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-zinc-300">
                재생 URL 발급 중...
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-serif text-lg font-bold text-[var(--color-primary)]">
                전체 진도율
              </h2>
              <span className="text-sm font-semibold text-[var(--color-primary)]">
                {status.overall_progress_pct}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full bg-[var(--color-accent)] transition-[width]"
                style={{ width: `${status.overall_progress_pct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              {course.min_progress_pct}% 이상 + 퀴즈 합격 시 수료 처리됩니다.
            </p>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => router.push(`/courses/${courseId}/quiz`)}
                disabled={!allLecturesDone}
                className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {allLecturesDone ? "퀴즈 풀기" : "모든 강의 시청 후 응시 가능"}
              </button>
            </div>
          </div>
        </div>

        <aside className="rounded-lg border border-[var(--color-border)] bg-white">
          <h3 className="border-b border-[var(--color-border)] px-4 py-3 font-serif text-base font-bold text-[var(--color-primary)]">
            커리큘럼
          </h3>
          <ol className="divide-y divide-[var(--color-border)]">
            {course.lectures.map((lec, idx) => (
              <CurriculumRow
                key={lec.id}
                index={idx + 1}
                lecture={lec}
                active={activeLectureId === lec.id}
                completed={completedIds.has(lec.id)}
                onClick={() => setActiveLectureId(lec.id)}
              />
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}

function CurriculumRow({
  index,
  lecture,
  active,
  completed,
  onClick,
}: {
  index: number;
  lecture: LectureItem;
  active: boolean;
  completed: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
          active ? "bg-[var(--color-primary)]/5" : "hover:bg-zinc-50"
        }`}
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            completed
              ? "bg-[var(--color-accent)] text-white"
              : active
                ? "bg-[var(--color-primary)] text-white"
                : "bg-zinc-200 text-zinc-600"
          }`}
        >
          {completed ? "✓" : index}
        </span>
        <span
          className={`flex-1 text-sm ${
            active ? "font-semibold text-[var(--color-primary)]" : "text-zinc-800"
          }`}
        >
          {lecture.title}
        </span>
      </button>
    </li>
  );
}
