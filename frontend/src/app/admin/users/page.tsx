"use client";

import { useEffect, useMemo, useState } from "react";
import {
  extendEnrollmentAccess,
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
import { useDialog } from "@/components/ui/DialogProvider";

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const size = 20;
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [courseCounts, setCourseCounts] = useState<CourseEnrollmentCount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openUser, setOpenUser] = useState<AdminUser | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  // "전체 사용자" 사이드바 행은 강의로 필터링 중에도 항상 전체 인원수를 보여줘야
  // 하므로, data.total(필터된 개수)과 별도로 전체 개수를 한 번 따로 들고 있는다.
  const [grandTotal, setGrandTotal] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminUsers(page, size, selectedCourseId ?? undefined)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        if (selectedCourseId == null) setGrandTotal(d.total);
      })
      .catch(() => !cancelled && setError("회원 목록을 불러오지 못했습니다."));
    return () => {
      cancelled = true;
    };
  }, [page, selectedCourseId]);

  function selectCourse(courseId: number | null) {
    setSelectedCourseId(courseId);
    setPage(1);
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
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

        <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-slate-200/60 bg-slate-50/50 text-[12px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">닉네임</th>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">연락처</th>
                <th className="px-4 py-3">이메일</th>
                <th className="px-4 py-3">가입일</th>
                <th className="px-4 py-3 text-right">수강 강의</th>
                <th className="px-4 py-3 text-right">결제 횟수</th>
                <th className="px-4 py-3 text-right">누적 결제금액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                    이 강의를 수강 중인 사용자가 없습니다.
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
      </div>

      {openUser ? (
        <UserEnrollmentsModal user={openUser} onClose={() => setOpenUser(null)} />
      ) : null}

      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-3 text-sm">
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
  );
}

function UserEnrollmentsModal({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
  const dialog = useDialog();
  const [rows, setRows] = useState<AdminUserEnrollmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCourseId, setExpandedCourseId] = useState<number | null>(null);
  const [extendingId, setExtendingId] = useState<number | null>(null);

  useEffect(() => {
    getAdminUserEnrollments(user.id)
      .then(setRows)
      .catch(() => setError("수강 목록을 불러오지 못했습니다."));
  }, [user.id]);

  async function handleExtend(enrollmentId: number) {
    setExtendingId(enrollmentId);
    try {
      const updated = await extendEnrollmentAccess(enrollmentId);
      setRows((prev) =>
        prev?.map((r) => (r.enrollment_id === enrollmentId ? updated : r)) ?? prev,
      );
    } catch {
      await dialog.alert("연장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setExtendingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-[20px] bg-white shadow-2xl ring-1 ring-slate-900/5"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
          <div>
            <h2 className="font-sans text-xl font-bold tracking-tight text-slate-900">
              {user.username} 님의 수강 현황
            </h2>
            <p className="mt-2 text-[13px] font-medium text-slate-500">
              {user.email} · <span className="text-slate-400">등록</span> {user.enrollment_count}건 · <span className="text-slate-400">결제</span>{" "}
              {user.payment_count}건 · <span className="text-slate-400">누적</span> {user.total_payment.toLocaleString()}원
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : rows == null ? (
            <p className="text-sm text-slate-500">불러오는 중...</p>
          ) : rows.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-slate-200 border-dashed bg-white">
              <p className="text-sm font-medium text-slate-500">수강 등록한 강의가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((r) => {
                const isExpanded = expandedCourseId === r.course_id;
                return (
                  <div
                    key={r.course_id}
                    className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCourseId(isExpanded ? null : r.course_id)
                      }
                      className="grid w-full grid-cols-[1fr_180px_60px_60px_24px] items-center gap-4 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50/50"
                    >
                      <div>
                        <p className="text-[11px] font-bold text-blue-600">
                          {r.category}
                        </p>
                        <p className="mt-0.5 text-sm font-bold text-slate-900">
                          {r.course_title}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-[width]"
                            style={{ width: `${r.overall_progress_pct}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-[13px] font-bold text-slate-700">
                          {r.overall_progress_pct}%
                        </span>
                      </div>
                      <div className="text-center">
                        {r.is_completed ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                            수료
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </div>
                      <div className="text-center">
                        {r.quiz_passed ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                            통과
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </div>
                      <span className="flex items-center justify-center text-slate-400">
                        <svg className={`h-5 w-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </span>
                    </button>
                    {isExpanded ? (
                      <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                        <div className="mb-3 flex items-center justify-between rounded-lg bg-white px-3 py-2 text-[12px] shadow-sm ring-1 ring-slate-200/50">
                          <span className="font-medium text-slate-600">
                            {r.expires_at == null ? (
                              "수강기간 제한 없음"
                            ) : new Date(r.expires_at).getTime() < Date.now() ? (
                              <span className="font-bold text-red-600">
                                수강기간 만료됨 ({new Date(r.expires_at).toLocaleDateString("ko-KR")})
                              </span>
                            ) : (
                              <>수강기간 만료일: {new Date(r.expires_at).toLocaleDateString("ko-KR")}</>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleExtend(r.enrollment_id)}
                            disabled={extendingId === r.enrollment_id}
                            className="rounded-md bg-[var(--color-primary)] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
                          >
                            {extendingId === r.enrollment_id ? "연장 중..." : "30일 연장"}
                          </button>
                        </div>
                        {r.lectures.length === 0 ? (
                          <p className="py-2 text-center text-xs text-slate-400">
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
    <li className="grid grid-cols-[28px_1fr_220px_80px] items-center gap-4 rounded-lg bg-white px-4 py-3 text-[13px] shadow-sm ring-1 ring-slate-200/50">
      <span className="font-medium text-slate-400">{lec.order_index + 1}.</span>
      <p className="truncate font-semibold text-slate-700">{lec.lecture_title}</p>
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-[width] ${
              lec.is_completed
                ? "bg-emerald-400"
                : "bg-blue-500"
            }`}
            style={{ width: `${lec.progress_pct}%` }}
          />
        </div>
        <span className="w-10 text-right font-bold text-slate-600">
          {lec.progress_pct}%
        </span>
      </div>
      <div className="text-right">
        {lec.is_completed ? (
          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-600/10">완료</span>
        ) : (
          <span className="text-[12px] font-medium text-slate-500">
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
