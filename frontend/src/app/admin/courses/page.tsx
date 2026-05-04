"use client";

import { useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import {
  addLecture,
  createCourse,
  getCourses,
  setQuiz,
} from "@/lib/api";
import {
  COURSE_CATEGORIES,
  type CourseCategory,
  type CourseListItem,
} from "@/types/course";
import type { AdminQuizQuestion } from "@/types/admin";

type Modal =
  | { kind: "new" }
  | { kind: "lecture"; course: CourseListItem }
  | { kind: "quiz"; course: CourseListItem }
  | null;

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);

  async function load() {
    setError(null);
    try {
      setCourses(await getCourses());
    } catch {
      setError("강의 목록을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  function close() {
    setModal(null);
  }

  async function handleCreated() {
    close();
    await load();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">
            강의 관리
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            강의 등록 / 영상 추가 / 퀴즈 등록
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ kind: "new" })}
          className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
        >
          + 새 강의 등록
        </button>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">제목</th>
              <th className="px-4 py-3">카테고리</th>
              <th className="px-4 py-3 text-right">가격</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {courses.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 text-xs text-zinc-500">#{c.id}</td>
                <td className="px-4 py-3 font-medium">{c.title}</td>
                <td className="px-4 py-3 text-xs">{c.category}</td>
                <td className="px-4 py-3 text-right">{c.price.toLocaleString()}원</td>
                <td className="px-4 py-3 text-xs">{c.is_active ? "활성" : "비활성"}</td>
                <td className="px-4 py-3 space-x-2">
                  <button
                    type="button"
                    onClick={() => setModal({ kind: "lecture", course: c })}
                    className="rounded border border-zinc-300 px-2.5 py-1 text-xs hover:border-[var(--color-primary)]"
                  >
                    영상 추가
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal({ kind: "quiz", course: c })}
                    className="rounded border border-zinc-300 px-2.5 py-1 text-xs hover:border-[var(--color-primary)]"
                  >
                    퀴즈 등록
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal?.kind === "new" ? (
        <NewCourseModal onClose={close} onSaved={handleCreated} />
      ) : null}
      {modal?.kind === "lecture" ? (
        <NewLectureModal course={modal.course} onClose={close} onSaved={close} />
      ) : null}
      {modal?.kind === "quiz" ? (
        <QuizModal course={modal.course} onClose={close} onSaved={close} />
      ) : null}
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h2 className="font-sans text-lg font-bold text-[var(--color-primary)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-900"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20";

function NewCourseModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CourseCategory>(COURSE_CATEGORIES[0]);
  const [price, setPrice] = useState("110000");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createCourse({
        title,
        category,
        price: Number(price) || 0,
        description: description || undefined,
      });
      onSaved();
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="새 강의 등록" onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field label="제목">
          <input
            value={title}
            required
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
        <Field label="가격 (원)">
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="설명">
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
          />
        </Field>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <FormActions onCancel={onClose} submitting={submitting} />
      </form>
    </ModalShell>
  );
}

function NewLectureModal({
  course,
  onClose,
  onSaved,
}: {
  course: CourseListItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [orderIndex, setOrderIndex] = useState("0");
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await addLecture(course.id, {
        title,
        order_index: Number(orderIndex) || 0,
        video_url: videoUrl || undefined,
        duration_seconds: Number(duration) || 0,
      });
      onSaved();
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "추가에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title={`영상 추가 — ${course.title}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field label="제목">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="순서">
            <input
              type="number"
              min={0}
              value={orderIndex}
              onChange={(e) => setOrderIndex(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="재생 시간 (초)">
            <input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="영상 URL (또는 S3 키)">
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className={inputCls}
            placeholder="lectures/foo.mp4"
          />
        </Field>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <FormActions onCancel={onClose} submitting={submitting} />
      </form>
    </ModalShell>
  );
}

type QuestionDraft = {
  question_text: string;
  options: { option_text: string; is_correct: boolean }[];
};

function emptyQuestion(): QuestionDraft {
  return {
    question_text: "",
    options: [
      { option_text: "", is_correct: true },
      { option_text: "", is_correct: false },
      { option_text: "", is_correct: false },
      { option_text: "", is_correct: false },
    ],
  };
}

function QuizModal({
  course,
  onClose,
  onSaved,
}: {
  course: CourseListItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateQuestion(qIdx: number, patch: Partial<QuestionDraft>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIdx ? { ...q, ...patch } : q)),
    );
  }
  function updateOption(qIdx: number, oIdx: number, text: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i !== qIdx
          ? q
          : {
              ...q,
              options: q.options.map((o, j) =>
                j === oIdx ? { ...o, option_text: text } : o,
              ),
            },
      ),
    );
  }
  function setCorrect(qIdx: number, oIdx: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i !== qIdx
          ? q
          : {
              ...q,
              options: q.options.map((o, j) => ({ ...o, is_correct: j === oIdx })),
            },
      ),
    );
  }

  async function handleSubmit() {
    setError(null);
    if (
      questions.some(
        (q) => !q.question_text.trim() || q.options.some((o) => !o.option_text.trim()),
      )
    ) {
      setError("모든 문제와 선택지 내용을 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: AdminQuizQuestion[] = questions.map((q) => ({
        question_text: q.question_text,
        options: q.options,
      }));
      await setQuiz(course.id, payload);
      onSaved();
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title={`퀴즈 등록 — ${course.title}`} onClose={onClose}>
      <p className="mb-3 text-xs text-zinc-500">
        기존 퀴즈가 있으면 전체 교체됩니다. 각 문제는 정답 1개를 라디오로 표시하세요.
      </p>
      <div className="space-y-4">
        {questions.map((q, qIdx) => (
          <div key={qIdx} className="rounded border border-zinc-200 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--color-primary)]">
                문제 {qIdx + 1}
              </span>
              {questions.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setQuestions((prev) => prev.filter((_, i) => i !== qIdx))
                  }
                  className="text-xs text-zinc-500 hover:text-red-600"
                >
                  삭제
                </button>
              ) : null}
            </div>
            <input
              value={q.question_text}
              onChange={(e) => updateQuestion(qIdx, { question_text: e.target.value })}
              placeholder="문제 내용"
              className={inputCls + " mb-2"}
            />
            <div className="space-y-2">
              {q.options.map((o, oIdx) => (
                <label key={oIdx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`q-${qIdx}-correct`}
                    checked={o.is_correct}
                    onChange={() => setCorrect(qIdx, oIdx)}
                    className="accent-[var(--color-primary)]"
                  />
                  <input
                    value={o.option_text}
                    onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                    placeholder={`선택지 ${oIdx + 1}`}
                    className={inputCls + " flex-1"}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
          className="w-full rounded border border-dashed border-zinc-400 py-2 text-sm text-zinc-600 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        >
          + 문제 추가
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-5">
        <FormActions onCancel={onClose} submitting={submitting} onSubmit={handleSubmit} />
      </div>
    </ModalShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-zinc-800">{label}</label>
      {children}
    </div>
  );
}

function FormActions({
  onCancel,
  submitting,
  onSubmit,
}: {
  onCancel: () => void;
  submitting: boolean;
  onSubmit?: () => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
      >
        취소
      </button>
      {onSubmit ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
        >
          {submitting ? "저장 중..." : "저장"}
        </button>
      ) : (
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
        >
          {submitting ? "저장 중..." : "저장"}
        </button>
      )}
    </div>
  );
}
