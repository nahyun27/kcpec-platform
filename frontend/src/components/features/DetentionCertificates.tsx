"use client";

import { Download, FileText } from "lucide-react";
import { absUrl, markDocumentDownloaded } from "@/lib/api";
import type { DetentionMineRow } from "@/types/detention";

// 구속수용자 교육 수료증 바로 받기. 예전엔 마이페이지 "결제 내역" 탭의 묶음결제
// 카드 안에만 있어서(기본 탭은 "내 강의실") 보호자들이 못 찾는 문의가 왔다
// (2026-11). 신청 내역 페이지와 내 강의실 맨 위에서 바로 내려받게 한다.
export function DetentionCertificates({
  row,
  showHeader = true,
}: {
  row: DetentionMineRow;
  showHeader?: boolean;
}) {
  if (row.certificates.length === 0) return null;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
      {showHeader ? (
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-5 w-5 shrink-0 text-emerald-700" />
          <p className="text-base font-bold text-slate-900">
            {row.inmate_name}님 수료증 {row.certificates.length}건
          </p>
        </div>
      ) : null}
      <ul className="space-y-2">
        {row.certificates.map((c) => (
          <li
            key={c.document_id}
            className="flex flex-col gap-2 rounded-lg border border-emerald-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800">{c.course_title}</p>
              <p className="text-xs text-slate-400">발급번호 {c.issue_number}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {c.pdf_url ? (
                <a
                  href={absUrl(c.pdf_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void markDocumentDownloaded(c.order_id, c.document_id).catch(() => {})}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-bold text-white shadow-sm hover:bg-[var(--color-primary-hover)]"
                >
                  <Download className="h-4 w-4" /> 수료증
                </a>
              ) : null}
              {c.pledge_pdf_url ? (
                <a
                  href={absUrl(c.pledge_pdf_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void markDocumentDownloaded(c.order_id, c.document_id).catch(() => {})}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                >
                  <Download className="h-4 w-4" /> 서약서
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
