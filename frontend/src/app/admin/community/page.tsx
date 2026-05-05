"use client";

import { useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { createNotice, createPost, getNotices, getPosts } from "@/lib/api";
import {
  COMMUNITY_LABEL,
  type NoticeCategory,
  type NoticeListItem,
  type PostCategory,
  type PostListItem,
} from "@/types/community";

export default function AdminCommunityPage() {
  const [notices, setNotices] = useState<NoticeListItem[]>([]);
  const [columns, setColumns] = useState<PostListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      const [n, c] = await Promise.all([
        getNotices(undefined, 1, 50),
        getPosts("column", 1, 50),
      ]);
      setNotices(n.items);
      setColumns(c.items);
    } catch {
      setError("목록을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">
          커뮤니티
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          공지사항·자료실·전문가 칼럼을 등록하고 관리합니다.
        </p>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <NoticeForm onSaved={reload} />
      <NoticesTable rows={notices} />

      <ColumnForm onSaved={reload} />
      <ColumnsTable rows={columns} />
    </div>
  );
}

// ---------- forms ----------------------------------------------------------

const inputCls =
  "w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20";

function NoticeForm({ onSaved }: { onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<NoticeCategory>("notice");
  const [content, setContent] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await createNotice({
        title: title.trim(),
        category,
        content: content.trim(),
        file_url: fileUrl.trim() || undefined,
        is_pinned: pinned,
      });
      setTitle("");
      setContent("");
      setFileUrl("");
      setPinned(false);
      onSaved();
    } catch (caught) {
      const detail = isAxiosError(caught)
        ? (caught.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setErr(detail ?? "등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="font-sans text-lg font-bold text-[var(--color-primary)]">
        공지사항 / 자료실 등록
      </h2>
      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="카테고리">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as NoticeCategory)}
            className={inputCls}
          >
            <option value="notice">공지사항</option>
            <option value="resource">자료실</option>
          </select>
        </Field>
        <Field label="제목">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="내용">
            <textarea
              required
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className={`${inputCls} resize-y`}
            />
          </Field>
        </div>
        <Field label="첨부파일 URL (선택)">
          <input
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
            className="accent-[var(--color-primary)]"
          />
          상단 고정 (📌)
        </label>
        {err ? (
          <p className="md:col-span-2 text-sm text-red-600">{err}</p>
        ) : null}
        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {submitting ? "등록 중..." : "등록"}
          </button>
        </div>
      </form>
    </section>
  );
}

function ColumnForm({ onSaved }: { onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await createPost({
        category: "column" as PostCategory,
        title: title.trim(),
        content: content.trim(),
        author_name: author.trim() || "전문가",
      });
      setTitle("");
      setAuthor("");
      setContent("");
      onSaved();
    } catch (caught) {
      const detail = isAxiosError(caught)
        ? (caught.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setErr(detail ?? "등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="font-sans text-lg font-bold text-[var(--color-primary)]">
        전문가 칼럼 등록
      </h2>
      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="제목">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="작성자">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className={inputCls}
            placeholder="전문가"
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="본문">
            <textarea
              required
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className={`${inputCls} resize-y`}
            />
          </Field>
        </div>
        {err ? <p className="md:col-span-2 text-sm text-red-600">{err}</p> : null}
        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {submitting ? "등록 중..." : "등록"}
          </button>
        </div>
      </form>
    </section>
  );
}

// ---------- tables ---------------------------------------------------------

function NoticesTable({ rows }: { rows: NoticeListItem[] }) {
  return (
    <section>
      <h2 className="mb-3 font-sans text-base font-bold text-[var(--color-primary)]">
        등록된 공지/자료
      </h2>
      <SimpleTable
        empty="등록된 공지가 없습니다."
        rows={rows.map((r) => ({
          id: r.id,
          title: r.title,
          meta: COMMUNITY_LABEL[r.category],
          pinned: r.is_pinned,
          created_at: r.created_at,
        }))}
      />
    </section>
  );
}

function ColumnsTable({ rows }: { rows: PostListItem[] }) {
  return (
    <section>
      <h2 className="mb-3 font-sans text-base font-bold text-[var(--color-primary)]">
        등록된 전문가 칼럼
      </h2>
      <SimpleTable
        empty="등록된 칼럼이 없습니다."
        rows={rows.map((r) => ({
          id: r.id,
          title: r.title,
          meta: r.author_name,
          pinned: false,
          created_at: r.created_at,
        }))}
      />
    </section>
  );
}

function SimpleTable({
  rows,
  empty,
}: {
  rows: { id: number; title: string; meta: string; pinned: boolean; created_at: string }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
        {empty}
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="w-16 px-4 py-3">ID</th>
            <th className="px-4 py-3">제목</th>
            <th className="w-32 px-4 py-3">분류</th>
            <th className="w-32 px-4 py-3">날짜</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 text-xs text-slate-500">#{r.id}</td>
              <td className="px-4 py-3">
                {r.pinned ? <span className="mr-1 text-[var(--color-accent)]">📌</span> : null}
                {r.title}
              </td>
              <td className="px-4 py-3 text-xs">{r.meta}</td>
              <td className="px-4 py-3 text-xs text-slate-500">
                {new Date(r.created_at).toLocaleDateString("ko-KR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
