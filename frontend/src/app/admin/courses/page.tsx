"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type DragEvent as ReactDragEvent,
} from "react";
import { GripVertical } from "lucide-react";
import { isAxiosError } from "axios";
import {
  addLecture,
  createCourse,
  deleteAdminLecture,
  getAdminCourseLectures,
  getAdminCourseQuiz,
  getAdminCourses,
  patchAdminLecture,
  patchCourse,
  setQuiz,
} from "@/lib/api";
import {
  COURSE_CATEGORIES,
  type CourseCategory,
  type CourseListItem,
} from "@/types/course";
import type {
  AdminLectureFull,
  AdminQuizQuestion,
  AdminQuizRead,
} from "@/types/admin";

type Modal =
  | { kind: "new-course" }
  | { kind: "edit-course"; course: CourseListItem }
  | { kind: "new-lecture"; course: CourseListItem }
  | { kind: "edit-lecture"; course: CourseListItem; lecture: AdminLectureFull }
  | { kind: "quiz"; course: CourseListItem }
  | null;

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [lecturesByCourse, setLecturesByCourse] = useState<
    Record<number, AdminLectureFull[]>
  >({});
  const [quizByCourse, setQuizByCourse] = useState<Record<number, AdminQuizRead>>({});

  async function load() {
    setError(null);
    try {
      const courseList = await getAdminCourses();
      setCourses(courseList);
      // 접힌 상태에서도 영상 수 + 퀴즈 상태 뱃지를 보여주기 위해 일괄 prefetch.
      // 모든 강의에 대해 lectures + quiz 를 병렬로 받아온다 (대략 N×2 요청).
      void Promise.all(
        courseList.flatMap((c) => [loadLectures(c.id), loadQuiz(c.id)]),
      );
    } catch {
      setError("강의 목록을 불러오지 못했습니다.");
    }
  }

  async function loadLectures(courseId: number) {
    try {
      const list = await getAdminCourseLectures(courseId);
      setLecturesByCourse((prev) => ({ ...prev, [courseId]: list }));
    } catch {
      setLecturesByCourse((prev) => ({ ...prev, [courseId]: [] }));
    }
  }

  async function loadQuiz(courseId: number) {
    try {
      const quiz = await getAdminCourseQuiz(courseId);
      setQuizByCourse((prev) => ({ ...prev, [courseId]: quiz }));
    } catch {
      setQuizByCourse((prev) => ({
        ...prev,
        [courseId]: { exists: false, questions: [] },
      }));
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleOpen(courseId: number) {
    if (openId === courseId) {
      setOpenId(null);
      return;
    }
    setOpenId(courseId);
    if (lecturesByCourse[courseId] === undefined) void loadLectures(courseId);
    if (quizByCourse[courseId] === undefined) void loadQuiz(courseId);
  }

  async function afterMutation(courseId?: number) {
    setModal(null);
    await load();
    if (courseId != null) {
      await loadLectures(courseId);
      await loadQuiz(courseId);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">
            강의 관리
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            전체 {courses.length.toLocaleString()}개 · 행을 클릭해 영상 목록 확인
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ kind: "new-course" })}
          className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
        >
          + 새 강의 등록
        </button>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-slate-200/60 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-12 px-5 py-4 text-center">#</th>
              <th className="px-5 py-4">제목</th>
              <th className="px-5 py-4">카테고리</th>
              <th className="px-5 py-4 text-right">가격</th>
              <th className="px-5 py-4 text-center">활성</th>
              <th className="px-5 py-4 text-right">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {courses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-500">
                  등록된 강의가 없습니다.
                </td>
              </tr>
            ) : (
              courses.flatMap((c) => {
                const open = openId === c.id;
                return [
                  <tr
                    key={c.id}
                    onClick={() => toggleOpen(c.id)}
                    className={`cursor-pointer transition-colors ${
                      open ? "bg-slate-50/80" : "hover:bg-slate-50/50"
                    }`}
                  >
                    <td className="px-5 py-4 text-center text-xs text-slate-500">
                      {c.id}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      <span
                        className={`mr-2 inline-block transition-transform text-slate-400 ${
                          open ? "rotate-90" : ""
                        }`}
                      >
                        ▶
                      </span>
                      {c.title}
                      <CourseRowBadges
                        lectures={lecturesByCourse[c.id]}
                        quiz={quizByCourse[c.id]}
                      />
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">{c.category}</td>
                    <td className="px-5 py-4 text-right font-medium text-slate-700">
                      {c.price != null ? `${c.price.toLocaleString()}원` : "—"}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {c.is_active ? (
                        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                          활성
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-inset ring-slate-500/10">
                          비활성
                        </span>
                      )}
                    </td>
                    <td
                      className="px-5 py-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setModal({ kind: "new-lecture", course: c })}
                          className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                          영상 추가
                        </button>
                        <QuizButton
                          quiz={quizByCourse[c.id]}
                          onClick={() => setModal({ kind: "quiz", course: c })}
                        />
                        <button
                          type="button"
                          onClick={() => setModal({ kind: "edit-course", course: c })}
                          className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                          수정
                        </button>
                      </div>
                    </td>
                  </tr>,
                  open ? (
                    <tr key={`${c.id}-lectures`} className="bg-slate-50/30">
                      <td colSpan={6} className="px-5 py-4">
                        <LectureList
                          lectures={lecturesByCourse[c.id]}
                          onEdit={(lec) =>
                            setModal({ kind: "edit-lecture", course: c, lecture: lec })
                          }
                          onDelete={async (lec) => {
                            if (!confirm(`"${lec.title}" 영상을 삭제하시겠습니까?`)) return;
                            try {
                              await deleteAdminLecture(lec.id);
                              await loadLectures(c.id);
                            } catch (err) {
                              alert(
                                isAxiosError(err)
                                  ? (err.response?.data as { detail?: string } | undefined)
                                      ?.detail ?? "삭제 실패"
                                  : "삭제 실패",
                              );
                            }
                          }}
                          onReorder={async (orderedIds) => {
                            // 1-indexed order_index 를 모두 PATCH (병렬). 실패는 무시.
                            await Promise.all(
                              orderedIds.map((id, idx) =>
                                patchAdminLecture(id, { order_index: idx + 1 }).catch(
                                  () => null,
                                ),
                              ),
                            );
                            await loadLectures(c.id);
                          }}
                          onDurationDetected={async () => {
                            await loadLectures(c.id);
                          }}
                          onAddClick={() => setModal({ kind: "new-lecture", course: c })}
                        />
                      </td>
                    </tr>
                  ) : null,
                ];
              })
            )}
          </tbody>
        </table>
      </div>

      {modal?.kind === "new-course" ? (
        <NewCourseModal
          onClose={() => setModal(null)}
          onCreated={() => void afterMutation()}
        />
      ) : null}
      {modal?.kind === "edit-course" ? (
        <EditCourseModal
          course={modal.course}
          onClose={() => setModal(null)}
          onSaved={() => void afterMutation()}
        />
      ) : null}
      {modal?.kind === "new-lecture" ? (
        <NewLectureModal
          course={modal.course}
          onClose={() => setModal(null)}
          onCreated={() => void afterMutation(modal.course.id)}
        />
      ) : null}
      {modal?.kind === "edit-lecture" ? (
        <EditLectureModal
          lecture={modal.lecture}
          onClose={() => setModal(null)}
          onSaved={() => void afterMutation(modal.course.id)}
        />
      ) : null}
      {modal?.kind === "quiz" ? (
        <QuizModal
          course={modal.course}
          existing={quizByCourse[modal.course.id]}
          onClose={() => setModal(null)}
          onSaved={() => void afterMutation(modal.course.id)}
        />
      ) : null}
    </div>
  );
}

// ---------- collapsed-row badges -------------------------------------------

function CourseRowBadges({
  lectures,
  quiz,
}: {
  lectures: AdminLectureFull[] | undefined;
  quiz: AdminQuizRead | undefined;
}) {
  // 둘 다 prefetch 미완료 — 아무것도 안 보여줌 (깜빡임 방지)
  if (lectures === undefined && quiz === undefined) return null;

  return (
    <span className="ml-2 inline-flex items-center gap-1.5 align-middle">
      {lectures !== undefined ? (
        lectures.length > 0 ? (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
            🎬 {lectures.length}개
          </span>
        ) : (
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
            영상 없음
          </span>
        )
      ) : null}
      {quiz?.exists ? (
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
          퀴즈 {quiz.questions.length}문항
        </span>
      ) : null}
    </span>
  );
}

// ---------- quiz button ----------------------------------------------------

function QuizButton({
  quiz,
  onClick,
}: {
  quiz: AdminQuizRead | undefined;
  onClick: () => void;
}) {
  if (quiz === undefined) {
    return (
      <button
        type="button"
        disabled
        className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-400 shadow-sm"
      >
        퀴즈 …
      </button>
    );
  }
  if (!quiz.exists) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
      >
        퀴즈 등록
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-[var(--color-primary-hover)]"
    >
      퀴즈 수정
    </button>
  );
}

// ---------- lecture list (accordion content) -------------------------------

function LectureList({
  lectures,
  onEdit,
  onDelete,
  onReorder,
  onDurationDetected,
  onAddClick,
}: {
  lectures: AdminLectureFull[] | undefined;
  onEdit: (lec: AdminLectureFull) => void;
  onDelete: (lec: AdminLectureFull) => void;
  onReorder: (orderedIds: number[]) => Promise<void>;
  onDurationDetected: () => Promise<void>;
  onAddClick: () => void;
}) {
  // 로컬 미러 — 드래그 동안 즉시 시각 반영. props 가 갱신되면 동기화.
  const [items, setItems] = useState<AdminLectureFull[]>(lectures ?? []);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  // duration 자동 감지 시도 완료된 lecture id 캐시 (재시도 방지)
  const probedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    setItems(lectures ?? []);
  }, [lectures]);

  // duration_seconds 가 0 인 영상에 대해 1회만 자동 감지 PATCH.
  useEffect(() => {
    if (!lectures) return;
    const targets = lectures.filter(
      (l) => (l.duration_seconds ?? 0) <= 0 && l.video_url && !probedRef.current.has(l.id),
    );
    if (targets.length === 0) return;

    const cleanups: Array<() => void> = [];
    let needsRefresh = false;

    for (const lec of targets) {
      probedRef.current.add(lec.id);
      const video = document.createElement("video");
      video.preload = "metadata";
      let cancelled = false;
      const handleMeta = async () => {
        if (cancelled) return;
        const dur = Math.round(video.duration);
        if (!Number.isFinite(dur) || dur <= 0) return;
        try {
          await patchAdminLecture(lec.id, { duration_seconds: dur });
          needsRefresh = true;
          // 마지막 항목이면 한 번에 부모 새로고침
          if (lec === targets[targets.length - 1]) {
            await onDurationDetected();
            needsRefresh = false;
          }
        } catch {
          /* 실패해도 dedup 유지 — 사용자가 수동 재시도 가능 */
        }
      };
      video.onloadedmetadata = handleMeta;
      video.onerror = () => {
        /* URL 깨짐 등 — 그냥 무시 */
      };
      video.src = lec.video_url!;
      cleanups.push(() => {
        cancelled = true;
        video.onloadedmetadata = null;
        video.onerror = null;
        video.removeAttribute("src");
      });
    }

    return () => {
      for (const fn of cleanups) fn();
      // 비동기 결과가 도착했지만 마지막 항목 이전에 unmount 된 경우 — 다음 마운트에서 갱신됨
      if (needsRefresh) void onDurationDetected();
    };
  }, [lectures, onDurationDetected]);

  if (lectures === undefined) {
    return <p className="px-2 text-xs text-slate-500">불러오는 중...</p>;
  }

  function handleDragStart(e: ReactDragEvent<HTMLTableRowElement>, idx: number) {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    // Firefox 호환: setData 호출 없으면 드래그 자체가 시작 안 됨
    e.dataTransfer.setData("text/plain", String(idx));
  }

  function handleDragOver(e: ReactDragEvent<HTMLTableRowElement>, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragIdx == null || dragIdx === idx) return;
    if (overIdx !== idx) setOverIdx(idx);
  }

  function handleDrop(e: ReactDragEvent<HTMLTableRowElement>, idx: number) {
    e.preventDefault();
    if (dragIdx == null || dragIdx === idx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setItems(next);
    setDragIdx(null);
    setOverIdx(null);
    void onReorder(next.map((l) => l.id));
  }

  function handleDragEnd() {
    setDragIdx(null);
    setOverIdx(null);
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-slate-200/60 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200/60 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-8 px-3 py-2.5"></th>
              <th className="w-12 px-3 py-2.5 text-center">순서</th>
              <th className="px-4 py-2.5">제목</th>
              <th className="w-20 px-4 py-2.5 text-right">시간</th>
              <th className="px-4 py-2.5">video URL</th>
              <th className="w-32 px-4 py-2.5 text-right">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  등록된 영상이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((lec, idx) => (
                <tr
                  key={lec.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`transition-colors ${
                    dragIdx === idx
                      ? "opacity-40"
                      : overIdx === idx
                        ? "bg-[var(--color-primary)]/5"
                        : "hover:bg-slate-50/80"
                  }`}
                >
                  <td className="px-3 py-3 text-center text-slate-400">
                    <GripVertical className="mx-auto h-3.5 w-3.5 cursor-grab active:cursor-grabbing" />
                  </td>
                  <td className="px-3 py-3 text-center font-medium text-slate-500">{idx + 1}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {lec.title}
                    {!lec.is_active ? (
                      <span className="ml-1.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 ring-1 ring-inset ring-slate-500/10">
                        비활성
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {formatDuration(lec.duration_seconds)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {lec.video_url ? (
                      <a
                        href={lec.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[10px] underline hover:text-[var(--color-primary)]"
                      >
                        {abbreviate(lec.video_url, 36)}
                      </a>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEdit(lec)}
                        className="rounded border border-slate-200 px-2 py-0.5 text-slate-600 hover:border-slate-400"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(lec)}
                        className="rounded border border-red-200 px-2 py-0.5 text-red-600 hover:border-red-400 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onAddClick}
          className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
        >
          + 영상 추가
        </button>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s}초`;
}

function abbreviate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return `…${s.slice(-(maxLen - 1))}`;
}

// ---------- modals ---------------------------------------------------------

const inputCls =
  "w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20";

// 폼에 변경사항이 있으면 닫기 전 확인
function confirmClose(isDirty: boolean, onClose: () => void) {
  if (isDirty && !confirm("변경사항이 저장되지 않았습니다. 그래도 닫으시겠습니까?")) {
    return;
  }
  onClose();
}

function ModalShell({
  title,
  onClose,
  children,
  maxWidth = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    // 의도적으로 backdrop 클릭으로 닫지 않음 — 입력 도중 실수로 모달이 닫혀
    // 폼 내용이 사라지는 것을 방지. 닫으려면 우상단 "닫기" 버튼 또는 각 폼의
    // "취소" 버튼 사용.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl`}
      >
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-sans text-lg font-bold text-[var(--color-primary)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-900"
          >
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-zinc-800">{label}</label>
      {children}
    </div>
  );
}

function FormActions({
  onClose,
  submitting,
  submitLabel = "저장",
}: {
  onClose: () => void;
  submitting: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        disabled={submitting}
        className="rounded border border-zinc-300 px-4 py-2 text-sm text-slate-700"
      >
        취소
      </button>
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
      >
        {submitting ? "처리 중..." : submitLabel}
      </button>
    </div>
  );
}

function NewCourseModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CourseCategory>(COURSE_CATEGORIES[0]);
  const [price, setPrice] = useState(110_000);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isDirty = Boolean(title.trim() || description.trim());
  const safeClose = () => confirmClose(isDirty, onClose);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await createCourse({
        title: title.trim(),
        category,
        price,
        description: description.trim() || undefined,
      });
      onCreated();
    } catch (caught) {
      setErr(
        isAxiosError(caught)
          ? (caught.response?.data as { detail?: string } | undefined)?.detail ??
              "등록 실패"
          : "등록 실패",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="새 강의 등록" onClose={safeClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="제목">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="카테고리">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CourseCategory)}
            className={inputCls}
          >
            {COURSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="가격(원)">
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        <Field label="설명">
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputCls} resize-y`}
          />
        </Field>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <FormActions onClose={safeClose} submitting={submitting} submitLabel="등록" />
      </form>
    </ModalShell>
  );
}

function EditCourseModal({
  course,
  onClose,
  onSaved,
}: {
  course: CourseListItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(course.title);
  const [category, setCategory] = useState<CourseCategory>(course.category);
  const [price, setPrice] = useState<number>(course.price ?? 0);
  const [isActive, setIsActive] = useState(course.is_active);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isDirty =
    title !== course.title ||
    category !== course.category ||
    price !== (course.price ?? 0) ||
    isActive !== course.is_active;
  const safeClose = () => confirmClose(isDirty, onClose);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await patchCourse(course.id, {
        title: title.trim(),
        category,
        price,
        is_active: isActive,
      });
      onSaved();
    } catch (caught) {
      setErr(
        isAxiosError(caught)
          ? (caught.response?.data as { detail?: string } | undefined)?.detail ??
              "수정 실패"
          : "수정 실패",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title={`강의 수정 — #${course.id}`} onClose={safeClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="제목">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="카테고리">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CourseCategory)}
            className={inputCls}
          >
            {COURSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="가격(원)">
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="accent-[var(--color-primary)]"
          />
          강의 활성화 (체크 해제 시 공개 목록에서 숨김)
        </label>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <FormActions onClose={safeClose} submitting={submitting} />
      </form>
    </ModalShell>
  );
}

function NewLectureModal({
  course,
  onClose,
  onCreated,
}: {
  course: CourseListItem;
  onClose: () => void;
  onCreated: () => void;
}) {
  const DEFAULT_URL = "http://localhost:8000/static/videos/";
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState(DEFAULT_URL);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isDirty = Boolean(title.trim()) || videoUrl !== DEFAULT_URL;
  const safeClose = () => confirmClose(isDirty, onClose);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      // order_index 는 백엔드가 자동 부여 (기존 lecture 수 + 1)
      await addLecture(course.id, {
        title: title.trim(),
        video_url: videoUrl.trim() || undefined,
      });
      onCreated();
    } catch (caught) {
      setErr(
        isAxiosError(caught)
          ? (caught.response?.data as { detail?: string } | undefined)?.detail ??
              "추가 실패"
          : "추가 실패",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title={`영상 추가 — ${course.title}`} onClose={safeClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="영상 제목">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="video URL">
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="http://localhost:8000/static/videos/sample.mp4"
            className={`${inputCls} font-mono text-xs`}
          />
          <p className="text-xs text-zinc-500">
            영상 길이는 사용자가 처음 재생할 때 자동으로 감지됩니다. 순서는 자동
            부여되며, 추가 후 목록에서 드래그로 변경할 수 있습니다.
          </p>
        </Field>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <FormActions onClose={safeClose} submitting={submitting} submitLabel="추가" />
      </form>
    </ModalShell>
  );
}

function EditLectureModal({
  lecture,
  onClose,
  onSaved,
}: {
  lecture: AdminLectureFull;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(lecture.title);
  const [orderIndex, setOrderIndex] = useState(lecture.order_index);
  const [videoUrl, setVideoUrl] = useState(lecture.video_url ?? "");
  const [isActive, setIsActive] = useState(lecture.is_active);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isDirty =
    title !== lecture.title ||
    orderIndex !== lecture.order_index ||
    videoUrl !== (lecture.video_url ?? "") ||
    isActive !== lecture.is_active;
  const safeClose = () => confirmClose(isDirty, onClose);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await patchAdminLecture(lecture.id, {
        title: title.trim(),
        order_index: orderIndex,
        video_url: videoUrl.trim() || null,
        is_active: isActive,
      });
      onSaved();
    } catch (caught) {
      setErr(
        isAxiosError(caught)
          ? (caught.response?.data as { detail?: string } | undefined)?.detail ??
              "수정 실패"
          : "수정 실패",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title={`영상 수정 — #${lecture.id}`} onClose={safeClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="영상 제목">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="video URL">
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className={`${inputCls} font-mono text-xs`}
          />
          <p className="text-xs text-zinc-500">
            영상 길이는 사용자가 재생할 때 자동으로 갱신됩니다.
          </p>
        </Field>
        <Field label="순서">
          <input
            type="number"
            min={0}
            value={orderIndex}
            onChange={(e) => setOrderIndex(Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="accent-[var(--color-primary)]"
          />
          영상 활성화
        </label>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <FormActions onClose={safeClose} submitting={submitting} />
      </form>
    </ModalShell>
  );
}

// ---------- quiz modal -----------------------------------------------------

type QuestionDraft = {
  question_text: string;
  options: { option_text: string; correct: boolean }[];
};

function blankQuestion(): QuestionDraft {
  return {
    question_text: "",
    options: [
      { option_text: "", correct: true },
      { option_text: "", correct: false },
      { option_text: "", correct: false },
      { option_text: "", correct: false },
    ],
  };
}

function QuizModal({
  course,
  existing,
  onClose,
  onSaved,
}: {
  course: CourseListItem;
  existing: AdminQuizRead | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!existing?.exists;
  const initialQuestions = useMemo<QuestionDraft[]>(() => {
    if (existing?.exists && existing.questions.length > 0) {
      return existing.questions.map((q) => ({
        question_text: q.question_text,
        options: q.options.map((o) => ({
          option_text: o.option_text,
          correct: o.is_correct,
        })),
      }));
    }
    return [blankQuestion()];
  }, [existing]);
  const [questions, setQuestions] = useState<QuestionDraft[]>(initialQuestions);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isDirty = JSON.stringify(questions) !== JSON.stringify(initialQuestions);
  const safeClose = () => confirmClose(isDirty, onClose);

  function addQuestion() {
    setQuestions((prev) => [...prev, blankQuestion()]);
  }

  function removeQuestion(qi: number) {
    setQuestions((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== qi),
    );
  }

  function updateQuestion(qi: number, text: string) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qi ? { ...q, question_text: text } : q)),
    );
  }

  function updateOption(qi: number, oi: number, text: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi
          ? {
              ...q,
              options: q.options.map((o, j) =>
                j === oi ? { ...o, option_text: text } : o,
              ),
            }
          : q,
      ),
    );
  }

  function setCorrect(qi: number, oi: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi
          ? { ...q, options: q.options.map((o, j) => ({ ...o, correct: j === oi })) }
          : q,
      ),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const payload: AdminQuizQuestion[] = questions.map((q) => ({
        question_text: q.question_text.trim(),
        options: q.options.map((o) => ({
          option_text: o.option_text.trim(),
          is_correct: o.correct,
        })),
      }));
      await setQuiz(course.id, payload);
      onSaved();
    } catch (caught) {
      setErr(
        isAxiosError(caught)
          ? (caught.response?.data as { detail?: string } | undefined)?.detail ??
              "저장 실패"
          : "저장 실패",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title={`${isEdit ? "퀴즈 수정" : "퀴즈 등록"} — ${course.title}`}
      onClose={safeClose}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          ⚠️ 저장 시 기존 퀴즈는 전체 교체됩니다.
          {isEdit ? " 기존 응시 기록은 그대로 보존됩니다." : ""}
        </p>
        {questions.map((q, qi) => (
          <div key={qi} className="space-y-2 rounded-lg border border-zinc-200 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-500">문제 {qi + 1}</p>
              {questions.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeQuestion(qi)}
                  className="text-[11px] text-red-500 hover:underline"
                >
                  삭제
                </button>
              ) : null}
            </div>
            <input
              required
              value={q.question_text}
              onChange={(e) => updateQuestion(qi, e.target.value)}
              placeholder="문제를 입력하세요"
              className={inputCls}
            />
            <div className="space-y-1.5">
              {q.options.map((o, oi) => (
                <label
                  key={oi}
                  className="flex items-center gap-2 rounded border border-zinc-200 px-3 py-1.5 text-sm"
                >
                  <input
                    type="radio"
                    name={`q-${qi}-correct`}
                    checked={o.correct}
                    onChange={() => setCorrect(qi, oi)}
                    className="accent-[var(--color-primary)]"
                  />
                  <input
                    required
                    value={o.option_text}
                    onChange={(e) => updateOption(qi, oi, e.target.value)}
                    placeholder={`선택지 ${oi + 1}`}
                    className="flex-1 border-none bg-transparent text-sm focus:outline-none"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addQuestion}
          className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
        >
          + 문제 추가
        </button>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <FormActions
          onClose={safeClose}
          submitting={submitting}
          submitLabel={isEdit ? "수정 저장" : "등록"}
        />
      </form>
    </ModalShell>
  );
}
