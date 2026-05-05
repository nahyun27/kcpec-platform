"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";
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
  LectureProgressItem,
} from "@/types/course";

const PROGRESS_INTERVAL_MS = 10_000;

const PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2] as const;
type PlaybackRate = (typeof PLAYBACK_RATES)[number];

// 앞으로 건너뛰기 허용 오차 (초). 0.5 미만의 작은 차이는 자연 재생/시크 노이즈로 간주.
const SEEK_TOLERANCE_SEC = 0.5;

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
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const watchedSecondsRef = useRef(0);
  const savedProgressRef = useRef<EnrollmentStatus["lecture_progresses"]>([]);

  // 사용자가 자연 재생으로 시청한 최대 위치. seek 시도가 이 값을 초과하면 되감김.
  const maxWatchedRef = useRef(0);
  // 우리가 programmatic 으로 currentTime 을 변경할 때 onSeeked 가 또 잡지 않도록.
  const programmaticSeekRef = useRef(false);
  // 사용자 드래그 중 timeupdate 가 max 를 오염시키지 않도록 (seeking → seeked 사이엔 max 갱신 X).
  const userSeekingRef = useRef(false);

  // 1) Initial load: course + ensure enrollment + first incomplete lecture.
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
        savedProgressRef.current = st.lecture_progresses;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // 2) On active lecture change: seed counters + max watched + fetch URL.
  useEffect(() => {
    if (activeLectureId == null) return;
    let cancelled = false;
    setStreamUrl(null);
    const saved = savedProgressRef.current.find((p) => p.lecture_id === activeLectureId);
    watchedSecondsRef.current = saved?.watched_seconds ?? 0;
    // 이전에 시청한 위치까지는 자유 이동 가능.
    maxWatchedRef.current = saved?.last_position_sec ?? 0;

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
  }, [activeLectureId]);

  // 3) Heartbeat: every 10s push progress, also bump max watched.
  useEffect(() => {
    if (activeLectureId == null) return;
    const lectureId = activeLectureId;

    const interval = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended) return;
      watchedSecondsRef.current += PROGRESS_INTERVAL_MS / 1000;
      const lastPos = Math.floor(video.currentTime);
      // heartbeat 시점에도 max 갱신 (timeupdate 가 빠뜨린 구간 보정).
      if (lastPos > maxWatchedRef.current) maxWatchedRef.current = lastPos;

      console.log(
        `[진도 업데이트] lecture=${lectureId} watched_seconds=${watchedSecondsRef.current}s last_position=${lastPos}s max=${maxWatchedRef.current}s`,
      );
      try {
        const next = await updateLectureProgress(lectureId, {
          watched_seconds: watchedSecondsRef.current,
          last_position_sec: lastPos,
          is_completed: false,
        });
        setStatus(next);
        savedProgressRef.current = next.lecture_progresses;
      } catch (err) {
        console.warn("[진도 업데이트] 실패", err);
      }
    }, PROGRESS_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [activeLectureId]);

  // 4) On video metadata load, restore last saved position (without triggering snap-back).
  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video || activeLectureId == null) return;
    // 배속도 복원
    video.playbackRate = playbackRate;
    const saved = savedProgressRef.current.find((p) => p.lecture_id === activeLectureId);
    if (saved && saved.last_position_sec > 0 && saved.last_position_sec < video.duration) {
      programmaticSeekRef.current = true;
      video.currentTime = saved.last_position_sec;
    }
  }

  // 5) 자연 재생 중 max watched 트래킹. seek 동작 중엔 갱신 안 함.
  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    if (userSeekingRef.current || video.seeking) return;
    if (video.currentTime > maxWatchedRef.current) {
      maxWatchedRef.current = video.currentTime;
    }
  }

  function handleSeeking() {
    userSeekingRef.current = true;
  }

  // 6) 사용자가 max 너머로 seek 하면 max 위치로 강제 복귀.
  function handleSeeked() {
    const video = videoRef.current;
    userSeekingRef.current = false;
    if (!video) return;
    if (programmaticSeekRef.current) {
      programmaticSeekRef.current = false;
      return;
    }
    if (video.currentTime > maxWatchedRef.current + SEEK_TOLERANCE_SEC) {
      console.log(
        `[건너뛰기 방지] requested=${video.currentTime.toFixed(1)}s → snap=${maxWatchedRef.current.toFixed(1)}s`,
      );
      programmaticSeekRef.current = true;
      video.currentTime = maxWatchedRef.current;
    }
  }

  async function handleEnded() {
    if (activeLectureId == null) return;
    const video = videoRef.current;
    if (video && video.duration) maxWatchedRef.current = video.duration;
    try {
      const next = await updateLectureProgress(activeLectureId, {
        watched_seconds: watchedSecondsRef.current,
        last_position_sec: video ? Math.floor(video.currentTime) : 0,
        is_completed: true,
      });
      setStatus(next);
      savedProgressRef.current = next.lecture_progresses;
    } catch {
      /* swallow */
    }
  }

  function handleRateChange(rate: PlaybackRate) {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }

  const completedIds = useMemo(
    () =>
      new Set(
        status?.lecture_progresses.filter((p) => p.is_completed).map((p) => p.lecture_id) ?? [],
      ),
    [status],
  );

  // lecture_id → progress 매핑 (사이드바 진행률 표시용).
  const progressByLecture = useMemo(() => {
    const m = new Map<number, LectureProgressItem>();
    for (const p of status?.lecture_progresses ?? []) m.set(p.lecture_id, p);
    return m;
  }, [status]);

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
                onTimeUpdate={handleTimeUpdate}
                onSeeking={handleSeeking}
                onSeeked={handleSeeked}
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

          {/* 배속 컨트롤 + 안내 */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5">
            <p className="text-xs text-zinc-500">
              ⓘ 시청하지 않은 구간으로 앞당겨 이동할 수 없습니다.
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-500">배속</span>
              {PLAYBACK_RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRateChange(r)}
                  className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${
                    playbackRate === r
                      ? "bg-[var(--color-primary)] text-white"
                      : "border border-zinc-200 text-zinc-600 hover:border-[var(--color-primary)]"
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-sans text-lg font-bold text-[var(--color-primary)]">
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
          <h3 className="border-b border-[var(--color-border)] px-4 py-3 font-sans text-base font-bold text-[var(--color-primary)]">
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
                progress={progressByLecture.get(lec.id)}
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
  progress,
  onClick,
}: {
  index: number;
  lecture: LectureItem;
  active: boolean;
  completed: boolean;
  progress: LectureProgressItem | undefined;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
          active ? "bg-[var(--color-primary)]/5" : "hover:bg-zinc-50"
        }`}
      >
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            completed
              ? "bg-[var(--color-accent)] text-white"
              : active
                ? "bg-[var(--color-primary)] text-white"
                : "bg-zinc-200 text-zinc-600"
          }`}
        >
          {completed ? "✓" : index}
        </span>
        <span className="flex-1 space-y-0.5">
          <span
            className={`block text-sm ${
              active ? "font-semibold text-[var(--color-primary)]" : "text-zinc-800"
            }`}
          >
            {lecture.title}
          </span>
          <LectureProgressLine lecture={lecture} progress={progress} completed={completed} />
        </span>
      </button>
    </li>
  );
}

function LectureProgressLine({
  lecture,
  progress,
  completed,
}: {
  lecture: LectureItem;
  progress: LectureProgressItem | undefined;
  completed: boolean;
}) {
  if (!progress || progress.watched_seconds <= 0) return null;
  if (completed) {
    return (
      <span className="block text-[11px] font-semibold text-emerald-600">완료 ✓</span>
    );
  }
  if (lecture.duration_seconds <= 0) return null;
  const pct = Math.min(
    100,
    Math.round((progress.watched_seconds * 1000) / lecture.duration_seconds) / 10,
  );
  return (
    <span className="block text-[11px] text-blue-600">
      {formatDuration(progress.watched_seconds)} ({pct.toFixed(1)}%) 진행 중
    </span>
  );
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}초`;
  return `${m}분 ${s.toString().padStart(2, "0")}초`;
}
