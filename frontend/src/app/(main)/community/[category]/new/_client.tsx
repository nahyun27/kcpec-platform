"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { createPost, tokenStorage } from "@/lib/api";
import { COMMUNITY_LABEL, type PostCategory } from "@/types/community";

export default function NewPostClient({ category }: { category: PostCategory }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenStorage.getAccess()) {
      router.replace(`/login?next=/community/${category}/new`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const post = await createPost({
        category,
        title: title.trim(),
        content: content.trim(),
        author_name: author.trim() || "익명",
      });
      router.push(`/community/${category}/${post.id}`);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "글 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 pb-24">
      <Link
        href={`/community/${category}`}
        className="text-sm text-slate-500 hover:text-[var(--color-primary)]"
      >
        ← {COMMUNITY_LABEL[category]} 목록
      </Link>

      <header className="mt-3">
        <h1 className="font-sans text-2xl font-extrabold tracking-tight text-[var(--color-primary)]">
          {COMMUNITY_LABEL[category]} 글쓰기
        </h1>
      </header>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <Field label="제목">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
            className={inputCls}
          />
        </Field>
        <Field label="작성자 (비워두면 '익명')">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            maxLength={50}
            className={inputCls}
            placeholder="익명"
          />
        </Field>
        <Field label="내용">
          <textarea
            required
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={`${inputCls} resize-y`}
          />
        </Field>
        {error ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Link
            href={`/community/${category}`}
            className="rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !content.trim()}
            className="rounded bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {submitting ? "등록 중..." : "등록"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded border border-zinc-300 px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-zinc-800">{label}</label>
      {children}
    </div>
  );
}
