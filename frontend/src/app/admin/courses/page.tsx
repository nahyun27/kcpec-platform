"use client";

import { useEffect, useState, type FormEvent } from "react";
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
      setCourses(await getAdminCourses());
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

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="w-12 px-3 py-3 text-center">#</th>
              <th className="px-3 py-3">제목</th>
              <th className="px-3 py-3">카테고리</th>
              <th className="px-3 py-3 text-right">가격</th>
              <th className="px-3 py-3 text-center">활성</th>
              <th className="px-3 py-3 text-right">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
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
                      open ? "bg-slate-50" : "hover:bg-slate-50/50"
                    }`}
                  >
                    <td className="px-3 py-3 text-center text-xs text-slate-500">
                      {c.id}
                    </td>
                    <td className="px-3 py-3 font-medium">
                      <span
                        className={`mr-2 inline-block transition-transform ${
                          open ? "rotate-90" : ""
                        }`}
                      >
                        ▶
                      </span>
                      {c.title}
                    </td>
                    <td className="px-3 py-3 text-xs">{c.category}</td>
                    <td className="px-3 py-3 text-right">
                      {c.price != null ? `${c.price.toLocaleString()}원` : "—"}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {c.is_active ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          활성
                        </span>
                      ) : (
                        <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600">
                          비활성
                        </span>
                      )}
                    </td>
                    <td
                      className="px-3 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setModal({ kind: "new-lecture", course: c })}
                          className="rounded border border-zinc-300 px-2.5 py-1 text-xs hover:border-[var(--color-primary)]"
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
                          className="rounded border border-zinc-300 px-2.5 py-1 text-xs hover:border-[var(--color-primary)]"
                        >
                          수정
                        </button>
                      </div>
                    </td>
                  </tr>,
                  open ? (
                    <tr key={`${c.id}-lectures`} className="bg-slate-50/40">
                      <td colSpan={6} className="px-3 py-4">
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
        className="rounded border border-zinc-200 px-2.5 py-1 text-xs text-zinc-400"
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
        className="rounded border border-zinc-300 px-2.5 py-1 text-xs hover:border-[var(--color-primary)]"
      >
        퀴즈 등록
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded bg-[var(--color-primary)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)]"
    >
      퀴즈 수정 ({quiz.questions.length}문항)
    </button>
  );
}

// ---------- lecture list (accordion content) -------------------------------

function LectureList({
  lectures,
  onEdit,
  onDelete,
  onAddClick,
}: {
  lectures: AdminLectureFull[] | undefined;
  onEdit: (lec: AdminLectureFull) => void;
  onDelete: (lec: AdminLectureFull) => void;
  onAddClick: () => void;
}) {
  if (lectures === undefined) {
    return <p className="px-2 text-xs text-slate-500">불러오는 중...</p>;
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded border border-zinc-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="w-14 px-3 py-2 text-center">순서</th>
              <th className="px-3 py-2">제목</th>
              <th className="w-20 px-3 py-2 text-right">시간</th>
              <th className="px-3 py-2">video URL</th>
              <th className="w-32 px-3 py-2 text-right">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {lectures.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                  등록된 영상이 없습니다.
                </td>
              </tr>
            ) : (
              lectures.map((lec) => (
                <tr key={lec.id}>
                  <td className="px-3 py-2 text-center text-zinc-500">{lec.order_index}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {lec.title}
                    {!lec.is_active ? (
                      <span className="ml-1 rounded bg-zinc-200 px-1.5 py-0.5 text-[9px] font-bold text-zinc-600">
                        비활성
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatDuration(lec.duration_seconds)}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">
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
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(lec)}
                        className="rounded border border-zinc-300 px-2 py-0.5 hover:border-[var(--color-primary)]"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(lec)}
                        className="rounded border border-red-300 px-2 py-0.5 text-red-600 hover:border-red-500"
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
  return m > 0 ? `${m}분${s ? ` ${s}초` : ""}` : `${s}초`;
}

function abbreviate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return `…${s.slice(-(maxLen - 1))}`;
}

// ---------- modals ---------------------------------------------------------

const inputCls =
  "w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20";

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
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
    <ModalShell title="새 강의 등록" onClose={onClose}>
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
        <FormActions onClose={onClose} submitting={submitting} submitLabel="등록" />
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
    <ModalShell title={`강의 수정 — #${course.id}`} onClose={onClose}>
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
        <FormActions onClose={onClose} submitting={submitting} />
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
  const [title, setTitle] = useState("");
  const [orderIndex, setOrderIndex] = useState(0);
  const [videoUrl, setVideoUrl] = useState(
    "http://localhost:8000/static/videos/sample_lecture.mp4",
  );
  const [duration, setDuration] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await addLecture(course.id, {
        title: title.trim(),
        order_index: orderIndex,
        video_url: videoUrl.trim() || undefined,
        duration_seconds: duration,
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
    <ModalShell title={`영상 추가 — ${course.title}`} onClose={onClose}>
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
            placeholder="http://..."
            className={`${inputCls} font-mono text-xs`}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="순서">
            <input
              type="number"
              min={0}
              value={orderIndex}
              onChange={(e) => setOrderIndex(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="재생시간(초)">
            <input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
        </div>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <FormActions onClose={onClose} submitting={submitting} submitLabel="추가" />
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
  const [duration, setDuration] = useState(lecture.duration_seconds);
  const [isActive, setIsActive] = useState(lecture.is_active);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await patchAdminLecture(lecture.id, {
        title: title.trim(),
        order_index: orderIndex,
        video_url: videoUrl.trim() || null,
        duration_seconds: duration,
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
    <ModalShell title={`영상 수정 — #${lecture.id}`} onClose={onClose}>
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
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="순서">
            <input
              type="number"
              min={0}
              value={orderIndex}
              onChange={(e) => setOrderIndex(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="재생시간(초)">
            <input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
        </div>
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
        <FormActions onClose={onClose} submitting={submitting} />
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
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => {
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
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
      onClose={onClose}
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
          onClose={onClose}
          submitting={submitting}
          submitLabel={isEdit ? "수정 저장" : "등록"}
        />
      </form>
    </ModalShell>
  );
}
