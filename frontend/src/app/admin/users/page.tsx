"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getAdminUserEnrollments,
  getAdminUsers,
  getCourseEnrollmentCounts,
} from "@/lib/api";
import type {
  AdminLectureProgressDetail,
  AdminUser,
  AdminUserEnrollmentRow,
  AdminUsersResponse,
  CourseEnrollmentCount,
} from "@/types/admin";

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const size = 20;
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [courseCounts, setCourseCounts] = useState<CourseEnrollmentCount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openUser, setOpenUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminUsers(page, size)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError("회원 목록을 불러오지 못했습니다."));
    return () => {
      cancelled = true;
    };
  }, [page]);

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
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">사용자</h1>
        <p className="mt-1 text-sm text-zinc-500">
          전체 {data.total.toLocaleString()}명 · 누적 수강 등록{" "}
          {totalEnrollments.toLocaleString()}건
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-1 rounded-lg border border-zinc-200 bg-white p-3 text-sm">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            강의별 수강생
          </p>
          <SidebarRow label="전체 사용자" value={data.total} bold />
          {courseCounts.length === 0 ? (
            <p className="px-3 py-2 text-xs text-zinc-400">통계 없음</p>
          ) : (
            courseCounts.map((c) => (
              <SidebarRow
                key={c.course_id}
                label={c.course_title}
                value={c.enrollment_count}
              />
            ))
          )}
        </aside>

        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-3">닉네임</th>
                <th className="px-3 py-3">이메일</th>
                <th className="px-3 py-3">가입일</th>
                <th className="px-3 py-3 text-right">수강 강의</th>
                <th className="px-3 py-3 text-right">결제 횟수</th>
                <th className="px-3 py-3 text-right">누적 결제금액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {data.items.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setOpenUser(u)}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                >
                  <td className="px-3 py-3 font-medium">
                    {u.username}
                    {u.is_admin ? (
                      <span className="ml-1 rounded bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        ADMIN
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-xs text-zinc-600">{u.email}</td>
                  <td className="px-3 py-3 text-xs text-zinc-500">
                    {new Date(u.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {u.enrollment_count.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {u.payment_count.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right font-medium">
                    {u.total_payment.toLocaleString()}원
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openUser ? (
        <UserEnrollmentsModal user={openUser} onClose={() => setOpenUser(null)} />
      ) : null}

      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, page - 1))}
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
            onClick={() => setPage(Math.min(totalPages, page + 1))}
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

function UserEnrollmentsModal({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<AdminUserEnrollmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCourseId, setExpandedCourseId] = useState<number | null>(null);

  useEffect(() => {
    getAdminUserEnrollments(user.id)
      .then(setRows)
      .catch(() => setError("수강 목록을 불러오지 못했습니다."));
  }, [user.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-baseline justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="font-sans text-lg font-bold text-[var(--color-primary)]">
              {user.username} 님의 수강 현황
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {user.email} · 등록 {user.enrollment_count}건 · 결제{" "}
              {user.payment_count}건 · 누적 {user.total_payment.toLocaleString()}원
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-900"
          >
            닫기
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : rows == null ? (
            <p className="text-sm text-zinc-500">불러오는 중...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-zinc-500">수강 등록한 강의가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => {
                const isExpanded = expandedCourseId === r.course_id;
                return (
                  <div
                    key={r.course_id}
                    className="overflow-hidden rounded-lg border border-zinc-200"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCourseId(isExpanded ? null : r.course_id)
                      }
                      className="grid w-full grid-cols-[1fr_180px_60px_60px_24px] items-center gap-3 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-xs font-medium text-[var(--color-accent)]">
                          {r.category}
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {r.course_title}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
                          <div
                            className="h-full bg-[var(--color-accent)] transition-[width]"
                            style={{ width: `${r.overall_progress_pct}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs font-semibold text-[var(--color-primary)]">
                          {r.overall_progress_pct}%
                        </span>
                      </div>
                      <div className="text-center">
                        {r.is_completed ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            수료 ✓
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </div>
                      <div className="text-center">
                        {r.quiz_passed ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            퀴즈 ✓
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400">
                        {isExpanded ? "▾" : "▸"}
                      </span>
                    </button>
                    {isExpanded ? (
                      <div className="border-t border-zinc-200 bg-slate-50 px-4 py-3">
                        {r.lectures.length === 0 ? (
                          <p className="py-2 text-xs text-zinc-500">
                            등록된 차시가 없습니다.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {r.lectures.map((lec) => (
                              <LectureProgressItem key={lec.lecture_id} lec={lec} />
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LectureProgressItem({ lec }: { lec: AdminLectureProgressDetail }) {
  const watchedMin = Math.floor(lec.watched_seconds / 60);
  const watchedSec = lec.watched_seconds % 60;
  const totalMin = Math.floor(lec.duration_seconds / 60);
  const totalSec = lec.duration_seconds % 60;

  return (
    <li className="grid grid-cols-[24px_1fr_220px_70px] items-center gap-3 rounded bg-white px-3 py-2 text-xs">
      <span className="text-zinc-400">{lec.order_index + 1}.</span>
      <p className="truncate font-medium text-slate-700">{lec.lecture_title}</p>
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-200">
          <div
            className={`h-full ${
              lec.is_completed
                ? "bg-emerald-500"
                : "bg-[var(--color-accent)]"
            }`}
            style={{ width: `${lec.progress_pct}%` }}
          />
        </div>
        <span className="w-9 text-right font-semibold text-[var(--color-primary)]">
          {lec.progress_pct}%
        </span>
      </div>
      <div className="text-right">
        {lec.is_completed ? (
          <span className="font-semibold text-emerald-600">완료 ✓</span>
        ) : (
          <span className="text-zinc-500">
            {watchedMin}:{String(watchedSec).padStart(2, "0")} /{" "}
            {totalMin}:{String(totalSec).padStart(2, "0")}
          </span>
        )}
      </div>
    </li>
  );
}

function SidebarRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded px-3 py-2 hover:bg-slate-50 ${
        bold ? "font-semibold text-[var(--color-primary)]" : "text-zinc-700"
      }`}
    >
      <span className="truncate text-xs">{label}</span>
      <span className="ml-2 shrink-0 text-xs">{value.toLocaleString()}</span>
    </div>
  );
}
