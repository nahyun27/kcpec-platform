"use client";

import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import {
  absUrl,
  editAdminLegalLetter,
  exportAdminLegalLetter,
  getAdminLegalLetters,
  previewAdminLegalLetter,
  regenerateAdminLegalLetter,
  uploadFinalLegalLetterPdf,
} from "@/lib/api";
import type { AdminLegalLetterRow } from "@/types/legalLetter";
import { useDialog } from "@/components/ui/DialogProvider";

function errMsg(err: unknown, fallback: string): string {
  const detail = isAxiosError(err)
    ? (err.response?.data as { detail?: unknown } | undefined)?.detail
    : null;
  return typeof detail === "string" ? detail : fallback;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AdminLegalLettersPage() {
  const dialog = useDialog();
  const [rows, setRows] = useState<AdminLegalLetterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  function load(pending: boolean) {
    getAdminLegalLetters(pending)
      .then((list) => {
        setRows(list);
        setError(null);
      })
      .catch(() => setError("목록을 불러오지 못했습니다."));
  }

  useEffect(() => {
    load(pendingOnly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOnly]);

  function replaceRow(updated: AdminLegalLetterRow) {
    setRows((prev) => (prev ?? []).map((r) => (r.id === updated.id ? updated : r)));
  }

  async function handleUpload(id: number, file: File) {
    setUploadingId(id);
    try {
      const updated = await uploadFinalLegalLetterPdf(id, file);
      replaceRow(updated);
    } catch (err) {
      await dialog.alert(errMsg(err, "최종본 업로드에 실패했습니다."));
    } finally {
      setUploadingId(null);
    }
  }

  if (error) return <p className="py-20 text-center text-sm text-red-600">{error}</p>;
  if (!rows) return <p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">
          반성문·탄원서 관리
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          행을 클릭하여 신청 내용을 확인하고, 워드로 다운로드해 서명 위치 등을 다듬은 뒤 최종
          PDF 를 업로드하면 신청자에게 자동 발송됩니다.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {[
          { value: true, label: "검토 대기" },
          { value: false, label: "전체" },
        ].map((f) => (
          <button
            key={String(f.value)}
            type="button"
            onClick={() => setPendingOnly(f.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              pendingOnly === f.value
                ? "bg-[var(--color-primary)] text-white"
                : "border border-zinc-200 bg-white text-slate-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
          해당하는 신청이 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-slate-200/60 bg-slate-50/50 text-[12px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">유형</th>
                <th className="px-4 py-3">신청자</th>
                <th className="px-4 py-3">신청일</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const released = !!r.released_at;
                return (
                  <tr
                    key={r.id}
                    onClick={() => setOpenId(r.id)}
                    className="cursor-pointer transition-colors hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3 text-xs text-slate-500">#{r.id}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          r.letter_type === "repentance"
                            ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/10"
                            : "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/10"
                        }`}
                      >
                        {r.letter_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {r.buyer_username}
                      <span className="ml-1.5 font-normal text-slate-400">{r.buyer_email}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(r.created_at).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          released
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10"
                            : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10"
                        }`}
                      >
                        {released ? "발급 완료" : "검토 대기"}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setOpenId(r.id)}
                          className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                          내용 보기
                        </button>
                        {released && r.pdf_url ? (
                          <a
                            href={absUrl(r.pdf_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-700"
                          >
                            최종본 PDF
                          </a>
                        ) : null}
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
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                        >
                          {uploadingId === r.id
                            ? "업로드 중..."
                            : released
                              ? "다시 업로드"
                              : "최종본 업로드"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openId != null ? (
        <LegalLetterDetailModal
          row={rows.find((r) => r.id === openId) ?? null}
          onChange={replaceRow}
          onClose={() => setOpenId(null)}
          onUpload={(file) => handleUpload(openId, file)}
          uploading={uploadingId === openId}
        />
      ) : null}
    </div>
  );
}

// ---------- 상세 모달 ------------------------------------------------------

const CASE_FIELDS: [string, (r: AdminLegalLetterRow) => string][] = [
  ["사건번호", (r) => r.case_number ?? "-"],
  ["죄명", (r) => r.charge],
  ["관할명", (r) => r.court_name],
];

function LegalLetterDetailModal({
  row,
  onChange,
  onClose,
  onUpload,
  uploading,
}: {
  row: AdminLegalLetterRow | null;
  onChange: (updated: AdminLegalLetterRow) => void;
  onClose: () => void;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const dialog = useDialog();
  const [draft, setDraft] = useState(row?.content ?? "");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  // row.id 가 바뀔 때(다른 건을 열 때)만 draft 를 그 row 의 content 로 리셋 —
  // 같은 row 안에서 save/regenerate 로 row 객체가 갱신될 때는 사용자가
  // 입력 중인 draft 를 덮어쓰지 않는다.
  const [lastId, setLastId] = useState(row?.id ?? null);
  if (row && row.id !== lastId) {
    setLastId(row.id);
    setDraft(row.content);
  }

  if (!row) return null;
  const released = !!row.released_at;

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      await dialog.alert(errMsg(err, "처리에 실패했습니다."));
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    run("save", async () => {
      const content = draft.trim();
      if (!content) {
        await dialog.alert("본문 내용을 입력해주세요.");
        return;
      }
      onChange(await editAdminLegalLetter(row.id, content));
    });

  const regenerate = () =>
    run("regen", async () => {
      const ok = await dialog.confirm(
        "AI로 본문을 다시 생성합니다. 저장하지 않은 수정 내용은 사라집니다. 계속할까요?",
      );
      if (!ok) return;
      onChange(await regenerateAdminLegalLetter(row.id, extraInstructions.trim()));
    });

  const preview = () =>
    run("preview", async () => {
      const content = draft.trim();
      if (content && content !== row.content) {
        onChange(await editAdminLegalLetter(row.id, content));
      }
      const { pdf_url } = await previewAdminLegalLetter(row.id);
      window.open(absUrl(pdf_url), "_blank", "noopener,noreferrer");
    });

  const download = (format: "docx" | "pdf") =>
    run(`export-${format}`, async () => {
      const content = draft.trim();
      if (content && content !== row.content) {
        onChange(await editAdminLegalLetter(row.id, content));
      }
      const blob = await exportAdminLegalLetter(row.id, format);
      downloadBlob(blob, `${row.letter_label}_${row.buyer_username}_${row.id}.${format}`);
    });

  const dirty = !released && draft !== row.content;

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
              {row.letter_label} #{row.id}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {row.buyer_username} · {row.buyer_email} ·{" "}
              {new Date(row.created_at).toLocaleString("ko-KR")}
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

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {[
              ...(row.defendant_name ? [["사건당사자", row.defendant_name]] : []),
              ...(row.relationship_to_defendant
                ? [["당사자와의 관계", row.relationship_to_defendant]]
                : []),
              ["작성자", `${row.writer_name} (${row.writer_birth})`],
              ...(row.writer_address ? [["주소", row.writer_address]] : []),
              ...(row.writer_phone ? [["연락처", row.writer_phone]] : []),
              ...CASE_FIELDS.map(([label, get]) => [label, get(row)]),
              ...(row.first_offense !== null
                ? [["초범 여부", row.first_offense ? "초범" : "동종전과 있음"]]
                : []),
              ...(row.case_stage ? [["사건 진행 단계", row.case_stage]] : []),
              ...(row.settlement_status ? [["합의 여부", row.settlement_status]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-28 shrink-0 text-slate-500">{k}</dt>
                <dd className="font-medium text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>

          {Object.keys(row.answer_labels).length > 0 ? (
            <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
              {Object.entries(row.answer_labels).map(([key, label]) => (
                <div key={key}>
                  <p className="text-xs font-bold text-slate-500">{label}</p>
                  <p className="whitespace-pre-wrap text-slate-800">{row.answers[key] || "-"}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500">
                AI 작성 본문{released ? " (발급 완료)" : ""}
              </p>
              {dirty ? <p className="text-xs font-bold text-amber-600">저장되지 않은 수정 있음</p> : null}
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={10}
              className="w-full rounded-lg border border-zinc-300 p-3 text-sm leading-relaxed"
            />
          </div>

          <div className="rounded-lg border border-zinc-200 bg-slate-50/60 p-3">
            <label className="block text-xs font-bold text-slate-700">
              AI 재생성 시 추가 지시사항 (선택)
            </label>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              비워두면 기본 프롬프트로만 재생성합니다. 답변에 없는 사실을 지어내진 않고,
              문체·강조점·분량 조정 정도로만 반영됩니다.
            </p>
            <textarea
              value={extraInstructions}
              onChange={(e) => setExtraInstructions(e.target.value)}
              rows={2}
              placeholder="예) 좀 더 간결하게, 재범 방지 의지를 더 강조해서"
              className="mt-2 w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs leading-relaxed placeholder:text-zinc-400"
            />
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-slate-50/50 px-6 py-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={save}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm disabled:opacity-50"
            >
              {busy === "save" ? "저장 중..." : "수정 내용 저장"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={regenerate}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm disabled:opacity-50"
            >
              {busy === "regen" ? "생성 중..." : "AI 다시 생성"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={preview}
              className="rounded-md border border-[var(--color-accent)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--color-accent)] shadow-sm disabled:opacity-50"
            >
              {busy === "preview" ? "생성 중..." : "PDF 미리보기"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => download("docx")}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm disabled:opacity-50"
            >
              {busy === "export-docx" ? "다운로드 중..." : "워드 다운로드"}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm disabled:opacity-60"
            >
              {uploading ? "업로드 중..." : released ? "최종본 다시 업로드" : "최종본 PDF 업로드"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
