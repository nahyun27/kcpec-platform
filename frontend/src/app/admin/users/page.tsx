"use client";

import { useEffect, useMemo, useState } from "react";
import { getAdminUsers, getCourseEnrollmentCounts } from "@/lib/api";
import type { AdminUser, AdminUsersResponse, CourseEnrollmentCount } from "@/types/admin";
import { UserEnrollmentsModal } from "@/components/features/UserEnrollmentsModal";

type SortKey =
  | "created_at_desc"
  | "created_at_asc"
  | "username_asc"
  | "username_desc"
  | "name_asc"
  | "name_desc"
  | "payment_desc"
  | "payment_asc"
  | "enrollment_desc"
  | "enrollment_asc";

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const size = 25;
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [courseCounts, setCourseCounts] = useState<CourseEnrollmentCount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openUser, setOpenUser] = useState<AdminUser | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("created_at_desc");
  // "전체 사용자" 사이드바 행은 강의로 필터링 중에도 항상 전체 인원수를 보여줘야
  // 하므로, data.total(필터된 개수)과 별도로 전체 개수를 한 번 따로 들고 있는다.
  const [grandTotal, setGrandTotal] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    getAdminUsers(page, size, selectedCourseId ?? undefined, debouncedSearch, sort)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        if (selectedCourseId == null && !debouncedSearch) setGrandTotal(d.total);
      })
      .catch(() => !cancelled && setError("회원 목록을 불러오지 못했습니다."));
    return () => {
      cancelled = true;
    };
  }, [page, selectedCourseId, debouncedSearch, sort]);

  function selectCourse(courseId: number | null) {
    setSelectedCourseId(courseId);
    setPage(1);
  }

  function toggleSort(asc: SortKey, desc: SortKey) {
    setSort((cur) => (cur === desc ? asc : desc));
    setPage(1);
  }

  function sortIndicator(asc: SortKey, desc: SortKey) {
    if (sort === asc) return " ▲";
    if (sort === desc) return " ▼";
    return "";
  }

  useEffect(() => {
    getCourseEnrollmentCounts().then(setCourseCounts).catch(() => setCourseCounts([]));
  }, []);

  const totalEnrollments = useMemo(
    () => courseCounts.reduce((acc, c) => acc + c.enrollment_count, 0),
    [courseCounts],
  );

  if (error) return <p className="py-20 text-center text-sm text-red-600">{error}</p>;
  if (!data) return <p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>;

  const totalPages = Math.max(1, Math.ceil(data.total / data.size));

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="font-sans text-3xl font-bold tracking-tight text-slate-900">사용자</h1>
        <p className="mt-1 text-sm text-slate-500">
          {selectedCourseId == null ? (
            <>
              전체 {data.total.toLocaleString()}명 · 누적 수강 등록{" "}
              {totalEnrollments.toLocaleString()}건
            </>
          ) : (
            <>
              <span className="font-semibold text-blue-600">
                {courseCounts.find((c) => c.course_id === selectedCourseId)?.course_title ?? "선택한 강의"}
              </span>{" "}
              수강생 {data.total.toLocaleString()}명
            </>
          )}
        </p>
      </header>

      <div className="flex items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="닉네임, 이름, 이메일로 검색"
          className="w-full max-w-xs rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-1 rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
          <p className="mb-3 px-3 py-1 text-[12px] font-bold uppercase tracking-widest text-slate-400">
            강의별 수강생
          </p>
          <SidebarRow
            label="전체 사용자"
            value={grandTotal ?? data.total}
            bold
            active={selectedCourseId == null}
            onClick={() => selectCourse(null)}
          />
          {courseCounts.length === 0 ? (
            <p className="px-3 py-2 text-xs text-zinc-400">통계 없음</p>
          ) : (
            courseCounts.map((c) => (
              <SidebarRow
                key={c.course_id}
                label={c.course_title}
                value={c.enrollment_count}
                active={selectedCourseId === c.course_id}
                onClick={() => selectCourse(c.course_id)}
              />
            ))
          )}
        </aside>

        <div>
        <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-slate-200/60 bg-slate-50/50 text-[12px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th
                  className="cursor-pointer select-none px-4 py-3 hover:text-slate-700"
                  onClick={() => toggleSort("username_asc", "username_desc")}
                >
                  닉네임{sortIndicator("username_asc", "username_desc")}
                </th>
                <th
                  className="cursor-pointer select-none px-4 py-3 hover:text-slate-700"
                  onClick={() => toggleSort("name_asc", "name_desc")}
                >
                  이름{sortIndicator("name_asc", "name_desc")}
                </th>
                <th className="px-4 py-3">연락처</th>
                <th className="px-4 py-3">이메일</th>
                <th
                  className="cursor-pointer select-none px-4 py-3 hover:text-slate-700"
                  onClick={() => toggleSort("created_at_asc", "created_at_desc")}
                >
                  가입일{sortIndicator("created_at_asc", "created_at_desc")}
                </th>
                <th
                  className="cursor-pointer select-none px-4 py-3 text-right hover:text-slate-700"
                  onClick={() => toggleSort("enrollment_asc", "enrollment_desc")}
                >
                  수강 강의{sortIndicator("enrollment_asc", "enrollment_desc")}
                </th>
                <th className="px-4 py-3 text-right">결제 횟수</th>
                <th
                  className="cursor-pointer select-none px-4 py-3 text-right hover:text-slate-700"
                  onClick={() => toggleSort("payment_asc", "payment_desc")}
                >
                  누적 결제금액{sortIndicator("payment_asc", "payment_desc")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                    {debouncedSearch
                      ? "검색 결과가 없습니다."
                      : "이 강의를 수강 중인 사용자가 없습니다."}
                  </td>
                </tr>
              ) : null}
              {data.items.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setOpenUser(u)}
                  className="cursor-pointer transition-colors hover:bg-slate-50/80"
                >
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      {u.username}
                      {u.is_admin && (
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-blue-700 ring-1 ring-inset ring-blue-600/20">
                          ADMIN
                        </span>
                      )}
                      {u.is_legacy_member && (
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-amber-700 ring-1 ring-inset ring-amber-600/20">
                          구회원
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.name ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-500">{u.phone ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-500">{u.email}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(u.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                    {u.enrollment_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                    {u.payment_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">
                    {u.total_payment.toLocaleString()}원
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-end gap-3 text-sm">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
            >
              이전
            </button>
            <span className="font-medium text-slate-500">
              {page} <span className="mx-1 font-normal text-slate-300">/</span> {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
            >
              다음
            </button>
          </div>
        ) : null}
        </div>
      </div>

      {openUser ? (
        <UserEnrollmentsModal user={openUser} onClose={() => setOpenUser(null)} />
      ) : null}
    </div>
  );
}

function SidebarRow({
  label,
  value,
  bold,
  active,
  onClick,
}: {
  label: string;
  value: number;
  bold?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left transition-colors ${
        active
          ? "bg-blue-50 text-blue-700"
          : bold
            ? "text-slate-900 hover:bg-slate-50"
            : "text-slate-600 hover:bg-slate-50"
      } ${bold ? "font-bold" : "font-medium"}`}
    >
      <span className="truncate text-[13px]">{label}</span>
      <span className="ml-2 shrink-0 text-[13px]">{value.toLocaleString()}</span>
    </button>
  );
}
