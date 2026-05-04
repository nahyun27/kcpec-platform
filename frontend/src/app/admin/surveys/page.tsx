"use client";

import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { getAdminSurveys, uploadFinalPdf } from "@/lib/api";
import type { AdminSurveyRow } from "@/types/admin";
import type { CounselingStatus } from "@/types/counseling";

export default function AdminSurveysPage() {
  const [rows, setRows] = useState<AdminSurveyRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

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
          Claude 초안을 검토 후 최종 PDF 를 업로드하면 사용자에게 자동 발송됩니다.
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
                <th className="px-4 py-3">초안</th>
                <th className="px-4 py-3">최종본 업로드</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-xs text-zinc-500">#{r.id}</td>
                  <td className="px-4 py-3">{r.username}</td>
                  <td className="px-4 py-3">{r.course_title}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(r.submitted_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-4 py-3">
                    <SurveyStatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    {r.ai_draft_url ? (
                      <a
                        href={r.ai_draft_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--color-primary)] underline"
                      >
                        초안 보기
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-400">생성 중</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "completed" && r.final_pdf_url ? (
                      <a
                        href={r.final_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--color-accent)] underline"
                      >
                        최종본 보기
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
                          className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
                        >
                          {uploadingId === r.id ? "업로드 중..." : "PDF 업로드"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
