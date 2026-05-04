"use client";

import { useEffect, useState } from "react";
import { getAdminUsers } from "@/lib/api";
import type { AdminUsersResponse } from "@/types/admin";

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const size = 20;
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminUsers(page, size)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError("회원 목록을 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  if (error) return <p className="py-20 text-center text-sm text-red-600">{error}</p>;
  if (!data) return <p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>;

  const totalPages = Math.max(1, Math.ceil(data.total / data.size));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">사용자</h1>
        <p className="mt-1 text-sm text-zinc-500">전체 {data.total.toLocaleString()}명</p>
      </header>

      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">아이디</th>
              <th className="px-4 py-3">이메일</th>
              <th className="px-4 py-3">생년월일</th>
              <th className="px-4 py-3">활성</th>
              <th className="px-4 py-3">관리자</th>
              <th className="px-4 py-3">가입일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {data.items.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 text-xs text-zinc-500">#{u.id}</td>
                <td className="px-4 py-3 font-medium">{u.username}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3 text-xs text-zinc-600">
                  {u.birth_date ?? "-"}
                </td>
                <td className="px-4 py-3">{u.is_active ? "✓" : "—"}</td>
                <td className="px-4 py-3">{u.is_admin ? "✓" : "—"}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {new Date(u.created_at).toLocaleDateString("ko-KR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
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
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="rounded border border-zinc-300 px-3 py-1.5 disabled:opacity-40"
      >
        다음
      </button>
    </div>
  );
}
