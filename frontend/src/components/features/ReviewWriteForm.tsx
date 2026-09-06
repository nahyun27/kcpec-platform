"use client";

import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { AlertCircle, Edit3, Loader2, Star } from "lucide-react";
import { createPost, getCourses } from "@/lib/api";
import type { CourseListItem } from "@/types/course";

interface Props {
  onCancel: () => void;
  onCreated: () => void | Promise<void>;
  // 강의 상세 페이지에서 열 때는 강의가 이미 정해져 있으므로 선택 UI를 숨기고 고정한다.
  fixedCourseId?: number;
  fixedCourseTitle?: string;
  // fixedCourseId 사용 시 getCourses() 를 호출하지 않아 courses 배열이 비므로,
  // course_category 를 courses.find() 로 역추적할 수 없음 — 호출부(강의 상세
  // 페이지는 이미 course 객체를 들고 있음)에서 직접 넘겨받는다.
  fixedCourseCategory?: string;
}

export function ReviewWriteForm({
  onCancel,
  onCreated,
  fixedCourseId,
  fixedCourseTitle,
  fixedCourseCategory,
}: Props) {
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [courseId, setCourseId] = useState<number | null>(fixedCourseId ?? null);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fixedCourseId != null) return;
    getCourses()
      .then((data) => {
        setCourses(data);
        setCourseId((prev) => prev ?? data[0]?.id ?? null);
      })
      .catch(() => {
        /* 강의 목록 실패해도 폼 자체는 계속 사용 가능해야 함 */
      });
  }, [fixedCourseId]);

  async function handleSubmit() {
    if (!content.trim()) {
      setError("후기 본문을 입력해 주세요.");
      return;
    }
    if (courseId == null) {
      setError("강의를 선택해 주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const selected = courses.find((c) => c.id === courseId);
      await createPost({
        category: "review",
        title: content.trim().slice(0, 80),
        content: content.trim(),
        author_name: author.trim() || "익명",
        course_id: courseId,
        course_category: fixedCourseCategory ?? selected?.category,
        rating,
      });
      await onCreated();
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "후기 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 rounded-3xl border border-blue-100 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]" />

      <div className="flex items-center gap-2 mb-2">
        <Edit3 className="h-5 w-5 text-[var(--color-primary)]" />
        <h3 className="font-sans text-xl font-bold text-slate-900">새로운 후기 작성</h3>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700">별점</label>
          <div className="flex items-center gap-1.5 h-11">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className="transition-transform hover:scale-110 focus:outline-none"
              >
                <Star
                  className={`h-7 w-7 ${n <= rating ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-200"}`}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700">수강 과정</label>
          {fixedCourseId != null ? (
            <div className="flex h-11 items-center rounded-xl border border-zinc-200 bg-slate-50 px-4 text-sm font-bold text-slate-700">
              {fixedCourseTitle}
            </div>
          ) : (
            <select
              value={courseId ?? ""}
              onChange={(e) => setCourseId(Number(e.target.value))}
              className="w-full h-11 rounded-xl border border-zinc-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700">
            작성자 <span className="text-slate-400 font-normal">(선택)</span>
          </label>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            maxLength={50}
            placeholder="비워두면 '익명'"
            className="w-full h-11 rounded-xl border border-zinc-200 bg-slate-50 px-4 text-sm font-medium placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-slate-700">후기 본문</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="강의를 들으신 소감이나 다른 분들께 도움이 될 만한 내용을 남겨주세요."
          className="w-full resize-y rounded-xl border border-zinc-200 bg-slate-50 p-4 text-sm font-medium leading-relaxed placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 custom-scrollbar"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-zinc-200 px-6 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-8 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] hover:shadow-lg disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "등록 중..." : "등록하기"}
        </button>
      </div>
    </div>
  );
}
