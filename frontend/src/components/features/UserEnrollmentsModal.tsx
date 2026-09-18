"use client";

import { useEffect, useState } from "react";
import { extendEnrollmentAccess, getAdminUserEnrollments } from "@/lib/api";
import type {
  AdminLectureProgressDetail,
  AdminUser,
  AdminUserEnrollmentRow,
} from "@/types/admin";
import { COUNSELING_STATUS_LABEL } from "@/types/counseling";
import { useDialog } from "@/components/ui/DialogProvider";

// 관리자 사용자 목록 / 주문 목록 등 여러 화면에서 "고객 클릭 → 수강현황 모달"
// 로 재사용하기 위해 공용 컴포넌트로 분리(2026-09).
export function UserEnrollmentsModal({
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
                      className="grid w-full grid-cols-[1fr_180px_88px_88px_24px] items-center gap-4 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50/50"
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
                          <span className="inline-flex items-center whitespace-nowrap rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                            수료
                          </span>
                        ) : (
                          <span className="inline-flex items-center whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold tracking-wide text-slate-500 ring-1 ring-inset ring-slate-500/10">
                            미수료
                          </span>
                        )}
                      </div>
                      <div className="text-center">
                        {r.category === "심리상담" && r.survey_status ? (
                          <span className="inline-flex items-center whitespace-nowrap rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                            설문 {COUNSELING_STATUS_LABEL[r.survey_status]}
                          </span>
                        ) : r.category === "심리상담" ? (
                          <span className="inline-flex items-center whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold tracking-wide text-slate-500 ring-1 ring-inset ring-slate-500/10">
                            설문 미제출
                          </span>
                        ) : !r.has_quiz ? (
                          <span className="inline-flex items-center whitespace-nowrap rounded-md bg-slate-50 px-2 py-1 text-[10px] font-bold tracking-wide text-slate-400 ring-1 ring-inset ring-slate-500/10">
                            퀴즈 없음
                          </span>
                        ) : r.quiz_passed ? (
                          <span className="inline-flex items-center whitespace-nowrap rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                            퀴즈 통과
                          </span>
                        ) : (
                          <span className="inline-flex items-center whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold tracking-wide text-slate-500 ring-1 ring-inset ring-slate-500/10">
                            퀴즈 미통과
                          </span>
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
                        <div className="mb-3 rounded-lg bg-white px-3 py-2.5 text-[12px] shadow-sm ring-1 ring-slate-200/50">
                          {r.document ? (
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide ring-1 ring-inset ${
                                    r.document.status === "revoked"
                                      ? "bg-red-50 text-red-600 ring-red-500/10"
                                      : "bg-blue-50 text-blue-700 ring-blue-500/10"
                                  }`}
                                >
                                  {r.document.status === "revoked"
                                    ? "무효화됨"
                                    : r.document.document_type === "counseling"
                                      ? "의견서 발급됨"
                                      : "수료증 발급됨"}
                                </span>
                                <span className="font-medium text-slate-500">{r.document.issue_number}</span>
                                <span
                                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide ring-1 ring-inset ${
                                    r.document.downloaded_at
                                      ? "bg-emerald-50 text-emerald-700 ring-emerald-500/10"
                                      : "bg-amber-50 text-amber-700 ring-amber-500/10"
                                  }`}
                                >
                                  {r.document.downloaded_at
                                    ? `다운로드함 (${new Date(r.document.downloaded_at).toLocaleDateString("ko-KR")})`
                                    : "미다운로드"}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                {r.document.pdf_url ? (
                                  <a
                                    href={r.document.pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-bold text-[var(--color-primary)] hover:underline"
                                  >
                                    서류 보기
                                  </a>
                                ) : null}
                                {r.document.pledge_pdf_url ? (
                                  <a
                                    href={r.document.pledge_pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-bold text-[var(--color-primary)] hover:underline"
                                  >
                                    서약서 보기
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          ) : (
                            <span className="font-medium text-slate-400">아직 발급된 서류 없음</span>
                          )}
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
