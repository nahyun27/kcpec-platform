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
import { Lock, RefreshCw } from "lucide-react";
import VideoPlayer, {
  type VideoPlayerTimeUpdate,
} from "@/components/features/VideoPlayer";
import {
  getCourseDetail,
  getCourseProgress,
  getStreamUrl,
  patchAdminLecture,
  updateLectureProgress,
} from "@/lib/api";
import type {
  CourseDetail,
  EnrollmentStatus,
  LectureItem,
} from "@/types/course";

const PROGRESS_INTERVAL_MS = 10_000;
// 한 번의 timeupdate 에서 누적할 최대 delta (초). 이 이상은 시크/점프로 간주.
const MAX_TIMEUPDATE_DELTA_SEC = 1.5;

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
  // 에러 원인을 분류해 사용자에게 다른 메시지 표시.
  // - inactive: 강의가 비공개(준비 중)
  // - not_enrolled: 결제/수강 신청 안 한 상태로 직접 접근
  // - server: 일시적 서버/네트워크 오류
  const [errKind, setErrKind] = useState<"inactive" | "not_enrolled" | "server" | null>(null);

  // 실시간 누적 시청 시간 (초). 서버 watched_seconds 로 초기화 후 timeupdate 마다 증가.
  const [liveWatched, setLiveWatched] = useState(0);
  // Plyr 가 실제 영상에서 감지한 duration. DB lecture.duration_seconds 가 0일 때
  // 일반 사용자에게도 진행률 % 가 정상 표시되도록 분모로 사용.
  const [playerDuration, setPlayerDuration] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const savedProgressRef = useRef<EnrollmentStatus["lecture_progresses"]>([]);
  const liveWatchedRef = useRef(0);
  const lastTimeRef = useRef(0);
  // 가장 최근 timeupdate 에서 받은 currentTime — heartbeat / flush 에 사용
  const lastCurrentTimeRef = useRef(0);
  // playerDuration state 의 ref 미러 — 인터벌 클로저에서 stale 안 되도록.
  const playerDurationRef = useRef(0);
  // 이미 완료 PATCH 를 보낸 강의 ID 집합 (중복 PATCH 방지)
  const completedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    playerDurationRef.current = playerDuration;
  }, [playerDuration]);

  useEffect(() => {
    if (!status) return;
    for (const p of status.lecture_progresses) {
      if (p.is_completed) completedRef.current.add(p.lecture_id);
    }
  }, [status]);

  // 1) 강의 + 수강 상태 초기 로드
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        // 1) 강의 detail. 비활성이고 권한 없으면 백엔드가 404 반환.
        let detail: CourseDetail;
        try {
          detail = await getCourseDetail(courseId);
        } catch (err) {
          if (cancelled) return;
          if (isAxiosError(err) && err.response?.status === 404) {
            setErrKind("inactive");
            return;
          }
          if (isAxiosError(err) && err.response?.status === 401) {
            router.push(`/login?next=/courses/${courseId}/watch`);
            return;
          }
          throw err;
        }
        if (cancelled) return;
        setCourse(detail);

        // 2) 진도 / enrollment 확인. 미수강이면 자동 enroll 하지 않고 안내 메시지 노출
        //    (결제 우회 방지).
        let st: EnrollmentStatus;
        try {
          st = await getCourseProgress(courseId);
        } catch (err) {
          if (cancelled) return;
          if (isAxiosError(err) && err.response?.status === 401) {
            router.push(`/login?next=/courses/${courseId}/watch`);
            return;
          }
          if (isAxiosError(err) && err.response?.status === 404) {
            setErrKind("not_enrolled");
            return;
          }
          throw err;
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
        if (!cancelled) setErrKind("server");
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
    const initialPos = saved?.last_position_sec ?? 0;
    liveWatchedRef.current = initialWatched;
    setLiveWatched(initialWatched);
    lastTimeRef.current = initialPos;
    lastCurrentTimeRef.current = initialPos;
    setPlayerDuration(0);

    getStreamUrl(activeLectureId)
      .then((res) => {
        if (!cancelled) setStreamUrl(res.url);
      })
      .catch(() => {
        if (!cancelled) setErrKind("server");
      });

    return () => {
      cancelled = true;
    };
  }, [activeLectureId]);

  // 3) 10초 인터벌 진도 PATCH
  useEffect(() => {
    if (activeLectureId == null) return;
    const lectureId = activeLectureId;

    const interval = setInterval(async () => {
      const dur = playerDurationRef.current;
      const payload = {
        watched_seconds: Math.floor(liveWatchedRef.current),
        last_position_sec: Math.floor(lastCurrentTimeRef.current),
        is_completed: false,
        ...(dur > 0 ? { duration_seconds: Math.round(dur) } : {}),
      };
      try {
        const next = await updateLectureProgress(lectureId, payload);
        setStatus(next);
        savedProgressRef.current = next.lecture_progresses;
      } catch (err) {
        const ax = isAxiosError(err) ? err : null;
        console.error(
          `[PATCH 실패] lecture=${lectureId} status=${ax?.response?.status}`,
          ax?.response?.data ?? err,
        );
      }
    }, PROGRESS_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [activeLectureId]);

  // ---- 콜백 -----------------------------------------------------------------

  // 95% 이상 또는 ended 시 호출. completedRef 로 1회만 실행.
  const markCompleted = useCallback(
    async (lectureId: number, duration: number) => {
      if (completedRef.current.has(lectureId)) return;
      completedRef.current.add(lectureId);

      const dur = Math.floor(duration);
      if (liveWatchedRef.current < dur) {
        liveWatchedRef.current = dur;
        setLiveWatched(dur);
      }

      const payload = {
        watched_seconds: dur,
        last_position_sec: dur,
        is_completed: true,
        ...(dur > 0 ? { duration_seconds: dur } : {}),
      };
      try {
        const next = await updateLectureProgress(lectureId, payload);
        setStatus(next);
        savedProgressRef.current = next.lecture_progresses;
      } catch (err) {
        // 실패 시 dedup 해제 — 다음 트리거에서 재시도 가능
        completedRef.current.delete(lectureId);
        const ax = isAxiosError(err) ? err : null;
        console.error(
          `[PATCH 실패 / 완료] lecture=${lectureId} status=${ax?.response?.status}`,
          ax?.response?.data ?? err,
        );
      }
    },
    [],
  );

  const handleLoadedMetadata = useCallback(
    (duration: number) => {
      if (Number.isFinite(duration) && duration > 0) {
        setPlayerDuration(duration);
      }
      const lectureId = activeLectureId;
      if (lectureId == null) return;
      // 어드민 백필 — 어드민만 성공 (다른 강의 메타도 갱신).
      // 일반 유저는 403 silent — 대신 진도 PATCH(/lectures/{id}/progress) 가
      // duration_seconds 를 함께 전달하므로 본인 수강 강의는 그쪽에서 갱신됨.
      const actualDuration = Math.round(duration);
      if (actualDuration > 0) {
        patchAdminLecture(lectureId, { duration_seconds: actualDuration })
          .then(() => {
            setCourse((prev) =>
              prev
                ? {
                    ...prev,
                    lectures: prev.lectures.map((l) =>
                      l.id === lectureId
                        ? { ...l, duration_seconds: actualDuration }
                        : l,
                    ),
                  }
                : prev,
            );
          })
          .catch(() => {
            /* 비어드민 사용자 — 진도 PATCH 에서 갱신됨 */
          });
      }
    },
    [activeLectureId],
  );

  const handleTimeUpdate = useCallback(
    (info: VideoPlayerTimeUpdate) => {
      const t = info.currentTime;
      lastCurrentTimeRef.current = t;
      const delta = t - lastTimeRef.current;
      // 자연 재생인 경우만 watched_seconds 누적
      if (
        delta > 0 &&
        delta < MAX_TIMEUPDATE_DELTA_SEC &&
        info.isPlaying &&
        !info.isSeeking
      ) {
        liveWatchedRef.current += delta;
        setLiveWatched(liveWatchedRef.current);
      }
      lastTimeRef.current = t;

      // 95% 이상 → 자동 완료
      if (
        activeLectureId != null &&
        info.duration > 0 &&
        t / info.duration >= 0.95 &&
        !completedRef.current.has(activeLectureId)
      ) {
        void markCompleted(activeLectureId, info.duration);
      }
    },
    [activeLectureId, markCompleted],
  );

  const handleEnded = useCallback(() => {
    if (activeLectureId == null) return;
    void markCompleted(activeLectureId, playerDuration);
  }, [activeLectureId, markCompleted, playerDuration]);

  // 강의 전환 직전 — 현재 진도 한 번 더 PATCH 해 저장 보장
  const flushProgressNow = useCallback(async () => {
    if (activeLectureId == null) return;
    const dur = playerDurationRef.current;
    const payload = {
      watched_seconds: Math.floor(liveWatchedRef.current),
      last_position_sec: Math.floor(lastCurrentTimeRef.current),
      is_completed: false,
      ...(dur > 0 ? { duration_seconds: Math.round(dur) } : {}),
    };
    try {
      await updateLectureProgress(activeLectureId, payload);
    } catch (err) {
      console.warn("[PATCH 강의 전환] 실패", err);
    }
  }, [activeLectureId]);

  // 새로고침: 서버 진도 재조회
  const handleRefresh = useCallback(async () => {
    if (refreshing || activeLectureId == null) return;
    setRefreshing(true);
    try {
      const next = await getCourseProgress(courseId);
      setStatus(next);
      savedProgressRef.current = next.lecture_progresses;
      const saved = next.lecture_progresses.find((p) => p.lecture_id === activeLectureId);
      if (saved) {
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

  // ---- 파생 값 ---------------------------------------------------------------

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
  const effectiveDuration =
    playerDuration > 0 ? playerDuration : activeLecture?.duration_seconds ?? 0;
  const currentPct =
    effectiveDuration > 0 ? Math.min(100, (liveWatched / effectiveDuration) * 100) : 0;

  // 활성 강의의 이어보기 시작점 (서버 last_position_sec)
  const initialTimeForActive =
    savedProgressRef.current.find((p) => p.lecture_id === activeLectureId)
      ?.last_position_sec ?? 0;

  if (errKind) {
    return <WatchErrorPanel kind={errKind} courseId={courseId} />;
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
            {streamUrl && activeLectureId != null ? (
              <VideoPlayer
                key={activeLectureId}
                src={streamUrl}
                initialTime={initialTimeForActive}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
              />
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
            <p className="mt-2 text-[11px] text-zinc-500">
              {course.min_progress_pct}% 이상
              {course.has_quiz ? " + 퀴즈 합격" : ""} 시 수료 처리됩니다.
            </p>
            {course.has_quiz ? (
              <button
                type="button"
                onClick={() => router.push(`/courses/${courseId}/quiz`)}
                disabled={!allLecturesDone}
                className="mt-3 w-full rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {allLecturesDone ? "퀴즈 풀기" : "모든 강의 시청 후 응시 가능"}
              </button>
            ) : null}
          </div>

          <ol className="divide-y divide-[var(--color-border)]">
            {course.lectures.map((lec, idx) => {
              const prev = idx === 0 ? null : course.lectures[idx - 1];
              const unlocked = prev == null || completedIds.has(prev.id);
              return (
                <CurriculumRow
                  key={lec.id}
                  index={idx + 1}
                  lecture={lec}
                  active={activeLectureId === lec.id}
                  completed={completedIds.has(lec.id)}
                  unlocked={unlocked}
                  onClick={async () => {
                    if (!unlocked) {
                      alert("이전 강의를 먼저 완료해주세요.");
                      return;
                    }
                    if (lec.id === activeLectureId) return;
                    await flushProgressNow();
                    setActiveLectureId(lec.id);
                  }}
                />
              );
            })}
          </ol>
        </aside>
      </div>
    </div>
  );
}

function WatchErrorPanel({
  kind,
  courseId,
}: {
  kind: "inactive" | "not_enrolled" | "server";
  courseId: number;
}) {
  const config: Record<typeof kind, { title: string; desc: string; cta?: { label: string; href: string } }> = {
    inactive: {
      title: "현재 준비 중인 강의입니다.",
      desc: "강의가 일시적으로 비공개 상태입니다. 관리자가 공개 후 다시 시도해 주세요.",
    },
    not_enrolled: {
      title: "수강 신청 후 이용하실 수 있습니다.",
      desc: "결제 완료 후에 강의를 시청하실 수 있습니다.",
      cta: { label: "강의 상세로 이동", href: `/courses/${courseId}` },
    },
    server: {
      title: "일시적인 오류가 발생했습니다.",
      desc: "잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.",
    },
  };
  const c = config[kind];
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <p className="font-sans text-xl font-bold text-[var(--color-primary)]">{c.title}</p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">{c.desc}</p>
      <div className="mt-6 flex flex-col gap-2">
        {c.cta ? (
          <Link
            href={c.cta.href}
            className="rounded bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
          >
            {c.cta.label}
          </Link>
        ) : null}
        <Link
          href="/courses"
          className="rounded border border-zinc-300 px-5 py-2.5 text-sm text-zinc-700 hover:border-[var(--color-primary)]"
        >
          강의 목록으로
        </Link>
      </div>
    </div>
  );
}

function CurriculumRow({
  index,
  lecture,
  active,
  completed,
  unlocked,
  onClick,
}: {
  index: number;
  lecture: LectureItem;
  active: boolean;
  completed: boolean;
  unlocked: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-disabled={!unlocked}
        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
          !unlocked
            ? "cursor-not-allowed bg-zinc-50/60"
            : active
              ? "bg-[var(--color-primary)]/5"
              : "hover:bg-zinc-50"
        }`}
      >
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            !unlocked
              ? "bg-zinc-200 text-zinc-400"
              : completed
                ? "bg-emerald-500 text-white"
                : active
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-zinc-200 text-zinc-600"
          }`}
        >
          {!unlocked ? (
            <Lock className="h-3 w-3" />
          ) : completed ? (
            "✓"
          ) : active ? (
            "▶"
          ) : (
            index
          )}
        </span>
        <span
          className={`flex-1 text-sm ${
            !unlocked
              ? "text-zinc-400"
              : completed
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
