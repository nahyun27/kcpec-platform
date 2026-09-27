"use client";

import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import {
  absUrl,
  editAdminLegalLetter,
  getAdminLegalLetters,
  previewAdminLegalLetter,
  regenerateAdminLegalLetter,
  releaseAdminLegalLetter,
} from "@/lib/api";
import type { AdminLegalLetterRow } from "@/types/legalLetter";
import { useDialog } from "@/components/ui/DialogProvider";

const CASE_FIELDS: [string, (r: AdminLegalLetterRow) => string][] = [
  ["사건번호", (r) => r.case_number ?? "-"],
  ["죄명", (r) => r.charge],
  ["관할명", (r) => r.court_name],
];

function errMsg(err: unknown, fallback: string): string {
  const detail = isAxiosError(err)
    ? (err.response?.data as { detail?: unknown } | undefined)?.detail
    : null;
  return typeof detail === "string" ? detail : fallback;
}

export default function AdminLegalLettersPage() {
  const dialog = useDialog();
  const [rows, setRows] = useState<AdminLegalLetterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingOnly, setPendingOnly] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  // AI 재생성 시 함께 보낼 추가 지시사항(선택) — 심리상담 의견서 재생성과
  // 동일한 패턴. row 별로 따로 기억(다른 건 재생성해도 지워지지 않게).
  const [extraInstructions, setExtraInstructions] = useState<Record<number, string>>({});

  function load(pending: boolean) {
    getAdminLegalLetters(pending)
      .then((list) => {
        setRows(list);
        setDrafts((prev) => {
          const next = { ...prev };
          for (const r of list) if (!(r.id in next)) next[r.id] = r.content;
          return next;
        });
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
    setDrafts((prev) => ({ ...prev, [updated.id]: updated.content }));
  }

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

  const regenerate = (r: AdminLegalLetterRow) =>
    run(`regen-${r.id}`, async () => {
      const ok = await dialog.confirm(
        "AI로 본문을 다시 생성합니다. 현재 화면에서 수정 중인 내용(저장하지 않은 부분)은 사라집니다. 계속할까요?",
      );
      if (!ok) return;
      replaceRow(await regenerateAdminLegalLetter(r.id, (extraInstructions[r.id] ?? "").trim()));
    });

  const save = (r: AdminLegalLetterRow) =>
    run(`save-${r.id}`, async () => {
      const content = (drafts[r.id] ?? "").trim();
      if (!content) {
        await dialog.alert("본문 내용을 입력해주세요.");
        return;
      }
      replaceRow(await editAdminLegalLetter(r.id, content));
    });

  const preview = (r: AdminLegalLetterRow) =>
    run(`preview-${r.id}`, async () => {
      // 미리보기는 저장된 content 기준으로 만들어지므로, 저장 안 한 수정
      // 내용이 있으면 먼저 저장부터 한다 — 안 그러면 화면에 보이는 초안과
      // 미리보기 PDF 내용이 다르게 나와 혼란만 준다.
      const draft = (drafts[r.id] ?? "").trim();
      if (draft && draft !== r.content) {
        replaceRow(await editAdminLegalLetter(r.id, draft));
      }
      const { pdf_url } = await previewAdminLegalLetter(r.id);
      window.open(absUrl(pdf_url), "_blank", "noopener,noreferrer");
    });

  const release = (r: AdminLegalLetterRow) =>
    run(`release-${r.id}`, async () => {
      const ok = await dialog.confirm(
        `${r.letter_label} 를 최종 발급 확정합니다. 확정 즉시 PDF 가 생성되고 신청자(${r.buyer_email})에게 발급 완료 메일이 발송됩니다. 이후에는 내용을 수정할 수 없습니다. 진행할까요?`,
      );
      if (!ok) return;
      const draft = (drafts[r.id] ?? "").trim();
      if (draft && draft !== r.content) {
        replaceRow(await editAdminLegalLetter(r.id, draft));
      }
      replaceRow(await releaseAdminLegalLetter(r.id));
    });

  if (error) return <p className="py-20 text-center text-sm text-red-600">{error}</p>;
  if (!rows) return <p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">
          반성문·탄원서 검토
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          신청자가 입력한 내용을 바탕으로 AI 가 작성한 초안입니다. 내용을 검토 후 필요하면 직접
          수정하거나 &apos;다시 생성&apos;으로 AI 초안을 새로 받으세요. &apos;PDF
          미리보기&apos;로 실제 서식에 채워진 모양(줄바꿈·페이지 넘김 등)을 먼저 확인할 수
          있으며, 미리보기는 신청자에게 노출되지 않습니다. 문제 없으면 &apos;발급 확정&apos;을
          눌러 PDF 를 발급하세요 — 확정 즉시 신청자 마이페이지에 PDF 가 노출되고 안내 메일이
          자동 발송되며, 더 이상 수정할 수 없습니다.
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
        rows.map((r) => {
          const released = !!r.released_at;
          const draft = drafts[r.id] ?? r.content;
          const dirty = !released && draft !== r.content;
          return (
            <article
              key={r.id}
              className="space-y-4 rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">
                    #{r.id} · {r.letter_label}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      released ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {released ? "발급 확정" : "검토 대기"}
                  </span>
                </div>
                <span className="text-xs text-zinc-500">
                  {new Date(r.created_at).toLocaleString("ko-KR")}
                </span>
              </div>

              <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {[
                  ["신청자", `${r.buyer_username} (${r.buyer_email})`],
                  ...(r.defendant_name ? [["사건당사자", r.defendant_name]] : []),
                  ...(r.relationship_to_defendant
                    ? [["당사자와의 관계", r.relationship_to_defendant]]
                    : []),
                  ["작성자", `${r.writer_name} (${r.writer_birth})`],
                  ...(r.writer_address ? [["주소", r.writer_address]] : []),
                  ...(r.writer_phone ? [["연락처", r.writer_phone]] : []),
                  ...CASE_FIELDS.map(([label, get]) => [label, get(r)]),
                  ...(r.first_offense !== null
                    ? [["초범 여부", r.first_offense ? "초범" : "동종전과 있음"]]
                    : []),
                  ...(r.case_stage ? [["사건 진행 단계", r.case_stage]] : []),
                  ...(r.settlement_status ? [["합의 여부", r.settlement_status]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-28 shrink-0 text-slate-500">{k}</dt>
                    <dd className="font-medium text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>

              {Object.keys(r.answer_labels).length > 0 ? (
                <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
                  {Object.entries(r.answer_labels).map(([key, label]) => (
                    <div key={key}>
                      <p className="text-xs font-bold text-slate-500">{label}</p>
                      <p className="whitespace-pre-wrap text-slate-800">{r.answers[key] || "-"}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500">AI 작성 본문{released ? " (확정됨)" : ""}</p>
                  {dirty ? <p className="text-xs font-bold text-amber-600">저장되지 않은 수정 있음</p> : null}
                </div>
                <textarea
                  value={draft}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))
                  }
                  readOnly={released}
                  rows={10}
                  className={`w-full rounded-lg border border-zinc-300 p-3 text-sm leading-relaxed ${
                    released ? "bg-slate-50 text-slate-600" : ""
                  }`}
                />
              </div>

              {!released ? (
                <div className="rounded-lg border border-zinc-200 bg-slate-50/60 p-3">
                  <label className="block text-xs font-bold text-slate-700">
                    AI 재생성 시 추가 지시사항 (선택)
                  </label>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    비워두면 기본 프롬프트로만 재생성합니다. 답변에 없는 사실을 지어내진
                    않고, 문체·강조점·분량 조정 정도로만 반영됩니다.
                  </p>
                  <textarea
                    value={extraInstructions[r.id] ?? ""}
                    onChange={(e) =>
                      setExtraInstructions((prev) => ({ ...prev, [r.id]: e.target.value }))
                    }
                    rows={2}
                    placeholder="예) 좀 더 간결하게, 재범 방지 의지를 더 강조해서"
                    className="mt-2 w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs leading-relaxed placeholder:text-zinc-400"
                  />
                </div>
              ) : null}

              {released ? (
                r.pdf_url ? (
                  <a
                    href={absUrl(r.pdf_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block font-bold text-[var(--color-accent)] hover:underline"
                  >
                    발급된 PDF 열기
                  </a>
                ) : null
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => save(r)}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50"
                  >
                    {busy === `save-${r.id}` ? "저장 중..." : "수정 내용 저장"}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => regenerate(r)}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {busy === `regen-${r.id}` ? "생성 중..." : "AI 다시 생성"}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => preview(r)}
                    className="rounded-lg border border-[var(--color-accent)] px-3 py-1.5 text-xs font-bold text-[var(--color-accent)] disabled:opacity-50"
                  >
                    {busy === `preview-${r.id}` ? "생성 중..." : "PDF 미리보기"}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => release(r)}
                    className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {busy === `release-${r.id}` ? "처리 중..." : "발급 확정"}
                  </button>
                </div>
              )}

              {r.released_at ? (
                <p className="border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                  발급 확정: {new Date(r.released_at).toLocaleString("ko-KR")}
                </p>
              ) : null}
            </article>
          );
        })
      )}
    </div>
  );
}
