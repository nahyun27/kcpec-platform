"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getNotices, getPosts, tokenStorage } from "@/lib/api";
import {
  COMMUNITY_LABEL,
  isNoticeCategory,
  type NoticeCategory,
  type NoticeListItem,
  type PostCategory,
  type PostListItem,
} from "@/types/community";

type Row = (NoticeListItem | PostListItem) & { is_pinned?: boolean };

export default function CategoryListClient({
  category,
}: {
  category: NoticeCategory | PostCategory;
}) {
  const router = useRouter();
  const isNotice = isNoticeCategory(category);
  const [page, setPage] = useState(1);
  const size = 20;
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const loader = isNotice
      ? getNotices(category as NoticeCategory, page, size)
      : getPosts(category as PostCategory, page, size);
    loader
      .then((d) => {
        if (cancelled) return;
        setRows(d.items as Row[]);
        setTotal(d.total);
      })
      .catch(() => !cancelled && setError("목록을 불러오지 못했습니다."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [category, isNotice, page]);

  const totalPages = Math.max(1, Math.ceil(total / size));
  const canWrite =
    !isNotice && (category === "qna" || category === "review");

  function handleWrite() {
    if (!tokenStorage.getAccess()) {
      router.push(`/login?next=/community/${category}/new`);
      return;
    }
    router.push(`/community/${category}/new`);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 pb-24">
      <Link
        href="/community"
        className="text-sm text-slate-500 hover:text-[var(--color-primary)]"
      >
        ← 커뮤니티 홈
      </Link>

      <header className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-sans text-3xl font-extrabold tracking-tight text-[var(--color-primary)]">
            {COMMUNITY_LABEL[category]}
          </h1>
          <p className="mt-1 text-sm text-slate-500">전체 {total.toLocaleString()}건</p>
        </div>
        {canWrite ? (
          <button
            type="button"
            onClick={handleWrite}
            className="rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
          >
            + 글쓰기
          </button>
        ) : null}
      </header>

      {loading ? (
        <p className="mt-12 text-center text-sm text-slate-500">불러오는 중...</p>
      ) : error ? (
        <p className="mt-12 text-center text-sm text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="mt-12 rounded-2xl border border-dashed border-zinc-300 bg-white py-16 text-center text-sm text-zinc-500">
          아직 등록된 글이 없습니다.
        </p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-16 px-4 py-3 text-center">번호</th>
                <th className="px-4 py-3">제목</th>
                {!isNotice ? <th className="w-32 px-4 py-3">작성자</th> : null}
                <th className="w-32 px-4 py-3 text-right">날짜</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-center text-xs text-slate-500">
                    {r.id}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/community/${category}/${r.id}`}
                      className="flex items-center gap-1.5 text-slate-800 hover:text-[var(--color-primary)]"
                    >
                      {"is_pinned" in r && r.is_pinned ? (
                        <span className="text-[var(--color-accent)]">📌</span>
                      ) : null}
                      <span className="truncate">{r.title}</span>
                    </Link>
                  </td>
                  {!isNotice ? (
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {(r as PostListItem).author_name}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 text-right text-xs text-slate-500">
                    {new Date(r.created_at).toLocaleDateString("ko-KR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border border-zinc-300 px-3 py-1.5 disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-zinc-600">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded border border-zinc-300 px-3 py-1.5 disabled:opacity-40"
          >
            다음
          </button>
        </div>
      ) : null}
    </div>
  );
}
