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
  type CSSProperties,
} from "react";
import { isAxiosError } from "axios";
import { RefreshCw } from "lucide-react";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
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
// 앞으로 건너뛰기 허용 오차 (초). 자연 재생/시크 노이즈는 무시.
const SEEK_TOLERANCE_SEC = 0.5;
// 한 번의 timeupdate 에서 누적할 최대 delta (초). 이 이상은 시크/점프로 간주.
const MAX_TIMEUPDATE_DELTA_SEC = 1.5;

const PLAYER_THEME: CSSProperties = {
  // Plyr 메인 색상 (시청 완료 구간 등)
  ["--plyr-color-main" as string]: "#1C3461",
};

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

  // 실시간 누적 시청 시간 (초). 서버 watched_seconds 로 초기화 후 timeupdate 마다 증가.
  const [liveWatched, setLiveWatched] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Plyr | null>(null);
  const savedProgressRef = useRef<EnrollmentStatus["lecture_progresses"]>([]);
  const liveWatchedRef = useRef(0);
  const maxWatchedRef = useRef(0);
  const lastTimeRef = useRef(0);

  // 1) 강의 + 수강 상태 초기 로드
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

  // 2) 활성 강의가 바뀌면 카운터 초기화 + 스트림 URL 발급
  useEffect(() => {
    if (activeLectureId == null) return;
    let cancelled = false;
    setStreamUrl(null);

    const saved = savedProgressRef.current.find((p) => p.lecture_id === activeLectureId);
    const initialWatched = saved?.watched_seconds ?? 0;
    const initialMax = saved?.last_position_sec ?? 0;
    liveWatchedRef.current = initialWatched;
    setLiveWatched(initialWatched);
    maxWatchedRef.current = initialMax;
    lastTimeRef.current = initialMax;

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

  // 3) Plyr 초기화/해제
  useEffect(() => {
    if (!streamUrl || activeLectureId == null) return;
    const video = videoRef.current;
    if (!video) return;

    const player = new Plyr(video, {
      speed: { selected: 1, options: [0.5, 1, 1.25, 1.5, 2] },
      controls: [
        "play",
        "progress",
        "current-time",
        "mute",
        "volume",
        "speed",
        "fullscreen",
      ],
    });
    playerRef.current = player;

    let isProgrammaticSeek = false;

    function onLoadedMetadata() {
      const saved = savedProgressRef.current.find(
        (p) => p.lecture_id === activeLectureId,
      );
      if (
        saved &&
        saved.last_position_sec > 0 &&
        saved.last_position_sec < player.duration
      ) {
        isProgrammaticSeek = true;
        player.currentTime = saved.last_position_sec;
        lastTimeRef.current = saved.last_position_sec;
      }
    }

    function onTimeUpdate() {
      const t = player.currentTime;
      const delta = t - lastTimeRef.current;
      // 자연 재생인 경우만 누적 (시크 점프/되감기 무시)
      if (
        delta > 0 &&
        delta < MAX_TIMEUPDATE_DELTA_SEC &&
        player.playing &&
        !player.seeking
      ) {
        liveWatchedRef.current += delta;
        setLiveWatched(liveWatchedRef.current);
        if (t > maxWatchedRef.current) maxWatchedRef.current = t;
      }
      lastTimeRef.current = t;
    }

    function onSeeking() {
      if (isProgrammaticSeek) {
        isProgrammaticSeek = false;
        return;
      }
      if (player.currentTime > maxWatchedRef.current + SEEK_TOLERANCE_SEC) {
        console.log(
          `[건너뛰기 방지] requested=${player.currentTime.toFixed(1)}s → snap=${maxWatchedRef.current.toFixed(1)}s`,
        );
        isProgrammaticSeek = true;
        player.currentTime = maxWatchedRef.current;
      }
    }

    async function onEnded() {
      if (activeLectureId == null) return;
      maxWatchedRef.current = player.duration;
      try {
        const next = await updateLectureProgress(activeLectureId, {
          watched_seconds: Math.floor(liveWatchedRef.current),
          last_position_sec: Math.floor(player.duration),
          is_completed: true,
        });
        setStatus(next);
        savedProgressRef.current = next.lecture_progresses;
        console.log(`[진도] overall=${next.overall_progress_pct}% (강의 완료)`);
      } catch (err) {
        console.warn("[진도] 완료 PATCH 실패", err);
      }
    }

    player.on("loadedmetadata", onLoadedMetadata);
    player.on("timeupdate", onTimeUpdate);
    player.on("seeking", onSeeking);
    player.on("ended", onEnded);

    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, [streamUrl, activeLectureId]);

  // 4) 10초 인터벌 진도 PATCH
  useEffect(() => {
    if (activeLectureId == null) return;
    const lectureId = activeLectureId;

    const interval = setInterval(async () => {
      const player = playerRef.current;
      if (!player || !player.playing) return;
      try {
        const next = await updateLectureProgress(lectureId, {
          watched_seconds: Math.floor(liveWatchedRef.current),
          last_position_sec: Math.floor(player.currentTime),
          is_completed: false,
        });
        setStatus(next);
        savedProgressRef.current = next.lecture_progresses;
        console.log(
          `[진도] overall=${next.overall_progress_pct}% watched=${Math.floor(liveWatchedRef.current)}s`,
        );
      } catch (err) {
        console.warn("[진도] 인터벌 PATCH 실패", err);
      }
    }, PROGRESS_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [activeLectureId]);

  // 5) 새로고침: 서버 진도 재조회
  const handleRefresh = useCallback(async () => {
    if (refreshing || activeLectureId == null) return;
    setRefreshing(true);
    try {
      const next = await getCourseProgress(courseId);
      setStatus(next);
      savedProgressRef.current = next.lecture_progresses;
      const saved = next.lecture_progresses.find((p) => p.lecture_id === activeLectureId);
      if (saved) {
        // 실시간 누적값과 서버값 중 큰 쪽 채택
        const merged = Math.max(saved.watched_seconds, liveWatchedRef.current);
        liveWatchedRef.current = merged;
        setLiveWatched(merged);
      }
    } catch (err) {
      console.warn("[진도] 새로고침 실패", err);
    } finally {
      setRefreshing(false);
    }
  }, [courseId, activeLectureId, refreshing]);

  const completedIds = useMemo(
    () =>
      new Set(
        status?.lecture_progresses.filter((p) => p.is_completed).map((p) => p.lecture_id) ?? [],
      ),
    [status],
  );

  const allLecturesDone =
    course != null &&
    course.lectures.length > 0 &&
    course.lectures.every((l) => completedIds.has(l.id));

  const totalLectures = course?.lectures.length ?? 0;
  const completedCount = course
    ? course.lectures.filter((l) => completedIds.has(l.id)).length
    : 0;
  const sidebarOverallPct = totalLectures > 0 ? (completedCount / totalLectures) * 100 : 0;

  const activeLecture = course?.lectures.find((l) => l.id === activeLectureId);
  const activeIsCompleted =
    activeLectureId != null && completedIds.has(activeLectureId);
  const lectureDuration = activeLecture?.duration_seconds ?? 0;
  const currentPct =
    lectureDuration > 0 ? Math.min(100, (liveWatched / lectureDuration) * 100) : 0;

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
          <div
            className="aspect-video w-full overflow-hidden rounded-lg bg-black"
            style={PLAYER_THEME}
          >
            {streamUrl ? (
              <video
                key={streamUrl}
                ref={videoRef}
                src={streamUrl}
                className="h-full w-full"
                playsInline
              >
                동영상을 재생할 수 없습니다.
              </video>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-zinc-300">
                재생 URL 발급 중...
              </div>
            )}
          </div>

          <p className="text-xs text-zinc-500">
            ⓘ 시청하지 않은 구간으로는 앞당겨 이동할 수 없습니다.
          </p>

          {/* 현재 강의 진행률 */}
          <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-sans text-lg font-bold text-[var(--color-primary)]">
                현재 강의 진행률
              </h2>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 hover:text-[var(--color-primary)] disabled:opacity-50"
                aria-label="진도 새로고침"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
                새로고침
              </button>
            </div>

            <div className="space-y-2">
              {activeIsCompleted ? (
                <p className="text-sm font-semibold text-emerald-600">✓ 완료</p>
              ) : (
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-[var(--color-primary)]">
                    {formatDuration(liveWatched)}
                  </span>
                  {" ("}
                  <span className="font-semibold">{currentPct.toFixed(1)}%</span>
                  {") 진행 중"}
                </p>
              )}
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                <div
                  className={`h-full transition-[width] ${
                    activeIsCompleted
                      ? "bg-emerald-500"
                      : "bg-[var(--color-accent)]"
                  }`}
                  style={{
                    width: `${activeIsCompleted ? 100 : currentPct}%`,
                  }}
                />
              </div>
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
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="font-sans text-sm font-bold text-[var(--color-primary)]">
                커리큘럼 진도
              </h3>
              <span className="text-xs font-semibold text-[var(--color-primary)]">
                {completedCount} / {totalLectures} 완료
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full bg-[var(--color-accent)] transition-[width]"
                style={{ width: `${sidebarOverallPct}%` }}
              />
            </div>
          </div>

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
        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
          active ? "bg-[var(--color-primary)]/5" : "hover:bg-zinc-50"
        }`}
      >
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            completed
              ? "bg-emerald-500 text-white"
              : active
                ? "bg-[var(--color-primary)] text-white"
                : "bg-zinc-200 text-zinc-600"
          }`}
        >
          {completed ? "✓" : active ? "▶" : index}
        </span>
        <span
          className={`flex-1 text-sm ${
            completed
              ? "font-medium text-emerald-700"
              : active
                ? "font-semibold text-[var(--color-primary)]"
                : "text-zinc-800"
          }`}
        >
          {lecture.title}
        </span>
      </button>
    </li>
  );
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}초`;
  return `${m}분 ${s.toString().padStart(2, "0")}초`;
}
