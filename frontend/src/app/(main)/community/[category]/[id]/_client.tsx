"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { getNotice, getPost } from "@/lib/api";
import {
  COMMUNITY_LABEL,
  isNoticeCategory,
  type NoticeCategory,
  type NoticeDetail,
  type PostCategory,
  type PostDetail,
} from "@/types/community";

export default function CategoryDetailClient({
  category,
  id,
}: {
  category: NoticeCategory | PostCategory;
  id: number;
}) {
  const isNotice = isNoticeCategory(category);
  const [data, setData] = useState<NoticeDetail | PostDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loader = isNotice ? getNotice(id) : getPost(id);
    loader
      .then((d) => !cancelled && setData(d))
      .catch((err) => {
        if (cancelled) return;
        if (isAxiosError(err) && err.response?.status === 404) {
          setError("해당 글을 찾을 수 없습니다.");
          return;
        }
        setError("불러오는 중 오류가 발생했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [id, isNotice]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Link
          href={`/community/${category}`}
          className="mt-6 inline-block rounded bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
        >
          목록으로
        </Link>
      </div>
    );
  }
  if (!data) {
    return <p className="py-20 text-center text-sm text-slate-500">불러오는 중...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 pb-24">
      <Link
        href={`/community/${category}`}
        className="text-sm text-slate-500 hover:text-[var(--color-primary)]"
      >
        ← {COMMUNITY_LABEL[category]} 목록
      </Link>

      <article className="mt-4 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <header className="border-b border-zinc-200 pb-4">
          <p className="text-xs font-bold tracking-widest text-[var(--color-accent)]">
            {COMMUNITY_LABEL[category]}
          </p>
          <h1 className="mt-2 font-sans text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {data.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {"author_name" in data ? (
              <span>작성자: {(data as PostDetail).author_name}</span>
            ) : null}
            <span>{new Date(data.created_at).toLocaleDateString("ko-KR")}</span>
            <span>조회 {data.view_count}</span>
          </div>
        </header>

        <div className="prose prose-sm max-w-none whitespace-pre-wrap pt-6 text-base leading-relaxed text-slate-700">
          {data.content}
        </div>

        {"file_url" in data && (data as NoticeDetail).file_url ? (
          <div className="mt-8 border-t border-zinc-200 pt-4">
            <a
              href={(data as NoticeDetail).file_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
            >
              📎 첨부파일 다운로드
            </a>
          </div>
        ) : null}
      </article>

      <div className="mt-6 flex justify-end">
        <Link
          href={`/community/${category}`}
          className="rounded border border-zinc-300 px-5 py-2 text-sm hover:border-[var(--color-primary)]"
        >
          목록으로
        </Link>
      </div>
    </div>
  );
}
