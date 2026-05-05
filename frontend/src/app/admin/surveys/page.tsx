"use client";

import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import {
  getAdminSurveyDetail,
  getAdminSurveys,
  uploadFinalPdf,
} from "@/lib/api";
import type { AdminSurveyDetail, AdminSurveyRow } from "@/types/admin";
import type { CounselingStatus } from "@/types/counseling";

export default function AdminSurveysPage() {
  const [rows, setRows] = useState<AdminSurveyRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});
  const [openId, setOpenId] = useState<number | null>(null);

  async function load() {
    setError(null);
    try {
      setRows(await getAdminSurveys());
    } catch {
      setError("의견서 목록을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpload(surveyId: number, file: File) {
    setUploadingId(surveyId);
    try {
      const updated = await uploadFinalPdf(surveyId, file);
      setRows((prev) => prev.map((r) => (r.id === surveyId ? updated : r)));
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      alert(detail ?? "최종본 업로드에 실패했습니다.");
    } finally {
      setUploadingId(null);
    }
  }

  if (error) return <p className="py-20 text-center text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">
          의견서 관리
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          행을 클릭하여 응답 상세를 확인하고, Claude 초안 검토 후 최종 PDF 를
          업로드하면 사용자에게 자동 발송됩니다.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
          제출된 설문이 없습니다.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">설문</th>
                <th className="px-4 py-3">사용자</th>
                <th className="px-4 py-3">강의</th>
                <th className="px-4 py-3">제출일</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setOpenId(r.id)}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-xs text-zinc-500">#{r.id}</td>
                  <td className="px-4 py-3">{r.username}</td>
                  <td className="px-4 py-3">{r.course_title}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(r.submitted_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-4 py-3">
                    <SurveyStatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setOpenId(r.id)}
                        className="rounded border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:border-[var(--color-primary)]"
                      >
                        응답 보기
                      </button>
                      {r.ai_draft_url ? (
                        <a
                          href={r.ai_draft_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:border-[var(--color-primary)]"
                        >
                          초안 보기
                        </a>
                      ) : null}
                      {r.status === "completed" && r.final_pdf_url ? (
                        <a
                          href={r.final_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded bg-[var(--color-accent)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)]"
                        >
                          최종본 PDF
                        </a>
                      ) : (
                        <>
                          <input
                            ref={(el) => {
                              fileInputs.current[r.id] = el;
                            }}
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleUpload(r.id, f);
                              e.target.value = "";
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => fileInputs.current[r.id]?.click()}
                            disabled={uploadingId === r.id}
                            className="rounded bg-[var(--color-primary)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
                          >
                            {uploadingId === r.id ? "업로드 중..." : "최종본 업로드"}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId != null ? (
        <SurveyDetailModal
          surveyId={openId}
          onClose={() => setOpenId(null)}
          onUpload={(file) => handleUpload(openId, file)}
        />
      ) : null}
    </div>
  );
}

// ---------- modal --------------------------------------------------------

const QUESTION_LABELS: Record<string, string> = {
  인적사항: "인적사항",
  사건내용: "이 사건의 내용",
  후회되는점: "이 사건에서 가장 후회되는 점",
  걱정되는점: "이 사건으로 인해 가장 걱정되는 점",
  재범방지노력: "추후 재범하지 않기 위해 스스로 노력해야 하는 점",
  하고싶은말: "더 하고 싶은 말 (선택사항)",
};

const ORDERED_KEYS = [
  "인적사항",
  "사건내용",
  "후회되는점",
  "걱정되는점",
  "재범방지노력",
  "하고싶은말",
];

function SurveyDetailModal({
  surveyId,
  onClose,
  onUpload,
}: {
  surveyId: number;
  onClose: () => void;
  onUpload: (file: File) => Promise<void> | void;
}) {
  const [detail, setDetail] = useState<AdminSurveyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    getAdminSurveyDetail(surveyId)
      .then(setDetail)
      .catch(() => setError("상세 정보를 불러오지 못했습니다."));
  }, [surveyId]);

  function renderResponses(responses: Record<string, string>) {
    // 알려진 키부터 정해진 순서로, 그 외 키는 뒤에 이어서.
    const known = ORDERED_KEYS.filter((k) => k in responses);
    const unknown = Object.keys(responses).filter((k) => !ORDERED_KEYS.includes(k));
    const all = [...known, ...unknown];
    if (all.length === 0) return <p className="text-sm text-zinc-500">응답이 없습니다.</p>;
    return (
      <dl className="space-y-5">
        {all.map((k) => (
          <div key={k}>
            <dt className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
              {QUESTION_LABELS[k] ?? k}
            </dt>
            <dd className="mt-1.5 whitespace-pre-wrap rounded-lg border border-zinc-200 bg-slate-50/50 px-4 py-3 text-sm leading-relaxed text-slate-800">
              {responses[k] || <span className="text-zinc-400">(빈 응답)</span>}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-baseline justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="font-sans text-lg font-bold text-[var(--color-primary)]">
              심리상담 설문 응답 #{surveyId}
            </h2>
            {detail ? (
              <p className="mt-1 text-xs text-zinc-500">
                {detail.username}
                {detail.user_email ? ` · ${detail.user_email}` : ""} ·{" "}
                {detail.course_title} ·{" "}
                {new Date(detail.submitted_at).toLocaleString("ko-KR")}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-900"
          >
            닫기
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : !detail ? (
            <p className="text-sm text-zinc-500">불러오는 중...</p>
          ) : (
            renderResponses(detail.responses)
          )}
        </div>

        {detail ? (
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-slate-50/50 px-6 py-4">
            <div className="flex flex-wrap gap-2">
              {detail.ai_draft_url ? (
                <a
                  href={detail.ai_draft_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:border-[var(--color-primary)]"
                >
                  Claude 초안 보기
                </a>
              ) : (
                <span className="text-xs text-zinc-400">초안 생성 중...</span>
              )}
              {detail.status === "completed" && detail.final_pdf_url ? (
                <a
                  href={detail.final_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)]"
                >
                  최종본 PDF
                </a>
              ) : null}
            </div>
            {detail.status !== "completed" ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUpload(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)]"
                >
                  최종본 업로드
                </button>
              </>
            ) : null}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

function SurveyStatusBadge({ status }: { status: CounselingStatus }) {
  const map: Record<CounselingStatus, { label: string; cls: string }> = {
    submitted: { label: "검토 대기", cls: "bg-zinc-200 text-zinc-700" },
    draft_generated: { label: "초안 생성", cls: "bg-blue-100 text-blue-700" },
    sent_to_staff: { label: "검토 중", cls: "bg-amber-100 text-amber-700" },
    completed: { label: "완료", cls: "bg-emerald-100 text-emerald-700" },
  };
  const { label, cls } = map[status];
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
