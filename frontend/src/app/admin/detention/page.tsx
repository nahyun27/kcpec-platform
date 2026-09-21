"use client";

import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import {
  absUrl,
  getAdminDetentionList,
  issueDetentionCertificate,
  patchAdminDetention,
  sendDetentionCertificates,
} from "@/lib/api";
import {
  DETENTION_STATUS_LABEL,
  type AdminDetentionRow,
  type DetentionStatus,
} from "@/types/detention";
import { useDialog } from "@/components/ui/DialogProvider";

const STATUS_FILTERS: { value: "" | DetentionStatus; label: string }[] = [
  { value: "", label: "전체" },
  { value: "received", label: "자료 발송 대기" },
  { value: "materials_sent", label: "발송 완료" },
  { value: "completed", label: "수료증 발송 완료" },
];

const STATUS_CLS: Record<DetentionStatus, string> = {
  received: "bg-amber-100 text-amber-800",
  materials_sent: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-zinc-100 text-zinc-500",
};

function errMsg(err: unknown, fallback: string): string {
  const detail = isAxiosError(err)
    ? (err.response?.data as { detail?: unknown } | undefined)?.detail
    : null;
  return typeof detail === "string" ? detail : fallback;
}

export default function AdminDetentionPage() {
  const dialog = useDialog();
  const [rows, setRows] = useState<AdminDetentionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"" | DetentionStatus>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { tracking: string; memo: string }>>({});

  useEffect(() => {
    getAdminDetentionList()
      .then((list) => {
        setRows(list);
        setDrafts(
          Object.fromEntries(
            list.map((r) => [r.id, { tracking: r.tracking_number ?? "", memo: r.admin_memo ?? "" }]),
          ),
        );
      })
      .catch(() => setError("목록을 불러오지 못했습니다."));
  }, []);

  function replaceRow(updated: AdminDetentionRow) {
    setRows((prev) => (prev ?? []).map((r) => (r.id === updated.id ? updated : r)));
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

  const saveInfo = (r: AdminDetentionRow, status?: DetentionStatus) =>
    run(`save-${r.id}`, async () => {
      const d = drafts[r.id] ?? { tracking: "", memo: "" };
      replaceRow(
        await patchAdminDetention(r.id, {
          ...(status ? { status } : {}),
          tracking_number: d.tracking.trim() || null,
          admin_memo: d.memo.trim() || null,
        }),
      );
    });

  const issue = (r: AdminDetentionRow, orderId: number) =>
    run(`issue-${orderId}`, async () => {
      replaceRow(await issueDetentionCertificate(r.id, orderId));
    });

  const send = (r: AdminDetentionRow) =>
    run(`send-${r.id}`, async () => {
      const ok = await dialog.confirm(
        `${r.certificate_email} 로 수료증을 발송하고 '수료증 발송 완료'로 처리합니다. 진행할까요?`,
      );
      if (!ok) return;
      const res = await sendDetentionCertificates(r.id);
      setRows(await getAdminDetentionList());
      await dialog.alert(
        res.emailed ? "수료증을 이메일로 발송했습니다." : "메일 발송에 실패했습니다. 메일 설정을 확인해 주세요.",
      );
    });

  if (error) return <p className="py-20 text-center text-sm text-red-600">{error}</p>;
  if (!rows) return <p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>;

  const shown = filter ? rows.filter((r) => r.status === filter) : rows;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">
          구속수용자 교육 관리
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          결제 완료된 신청만 표시됩니다. ① 교육자료 우편 발송 후 &apos;발송 완료&apos; 처리 → ② 발송 7일 후
          보호자가 학습 완료를 확인하면 → ③ 과정별 수료증 발급 → ④ 이메일 발송.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              filter === f.value
                ? "bg-[var(--color-primary)] text-white"
                : "border border-zinc-200 bg-white text-slate-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
          해당하는 신청이 없습니다.
        </p>
      ) : (
        shown.map((r) => {
          const courseOrders = r.orders.filter((o) => !o.is_fee && o.status === "paid");
          const confirmed = !!r.learning_confirmed_at;
          const allIssued = courseOrders.length > 0 && courseOrders.every((o) => o.document_id);
          const d = drafts[r.id] ?? { tracking: "", memo: "" };
          return (
            <article key={r.id} className="space-y-4 rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">
                    #{r.id} · {r.inmate_name}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_CLS[r.status]}`}>
                    {DETENTION_STATUS_LABEL[r.status]}
                  </span>
                  {!r.paid ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                      환불/미결제
                    </span>
                  ) : null}
                </div>
                <span className="text-xs text-zinc-500">
                  {new Date(r.created_at).toLocaleString("ko-KR")} · {r.total.toLocaleString()}원
                </span>
              </div>

              <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {[
                  ["생년월일", r.inmate_birth],
                  ["수용번호", r.inmate_number],
                  ["수용시설", r.facility_name],
                  ["주소", `${r.postal_code ? `(${r.postal_code}) ` : ""}${r.address}`],
                  ["배송 요청", r.delivery_note ?? "-"],
                  ["신청자", `${r.buyer_username} (${r.buyer_email})`],
                  ["연락처", r.contact_phone],
                  ["수료증 이메일", r.certificate_email],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-24 shrink-0 text-slate-500">{k}</dt>
                    <dd className="font-medium text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  placeholder="송장/등기 번호"
                  value={d.tracking}
                  onChange={(e) =>
                    setDrafts((p) => ({ ...p, [r.id]: { ...d, tracking: e.target.value } }))
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="관리자 메모"
                  value={d.memo}
                  onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: { ...d, memo: e.target.value } }))}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => saveInfo(r)}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50"
                >
                  송장·메모 저장
                </button>
                {r.status === "received" ? (
                  <button
                    type="button"
                    disabled={busy !== null || !r.paid}
                    onClick={() => saveInfo(r, "materials_sent")}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    자료 발송 완료 처리
                  </button>
                ) : null}
              </div>

              <p className={`border-t border-zinc-100 pt-4 text-sm font-semibold ${confirmed ? "text-emerald-700" : "text-zinc-500"}`}>
                {confirmed
                  ? `보호자 학습 완료 확인: ${new Date(r.learning_confirmed_at!).toLocaleString("ko-KR")}`
                  : r.confirm_available_at
                    ? `보호자 학습 완료 확인 대기 (${new Date(r.confirm_available_at).toLocaleDateString("ko-KR")} 이후 확인 가능)`
                    : "교육자료 발송 후 보호자 확인이 가능합니다."}
              </p>
              <ul className="space-y-2">
                {courseOrders.map((o) => (
                  <li key={o.order_id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-slate-800">{o.course_title}</span>
                    {o.document_id ? (
                      <span className="flex items-center gap-3 text-xs">
                        <span className="text-zinc-500">{o.issue_number}</span>
                        {o.pdf_url ? (
                          <a href={absUrl(o.pdf_url)} target="_blank" rel="noreferrer" className="font-bold text-[var(--color-accent)] hover:underline">
                            수료증
                          </a>
                        ) : null}
                        {o.pledge_pdf_url ? (
                          <a href={absUrl(o.pledge_pdf_url)} target="_blank" rel="noreferrer" className="font-bold text-[var(--color-accent)] hover:underline">
                            서약서
                          </a>
                        ) : null}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy !== null || r.status === "completed" || !confirmed}
                        onClick={() => issue(r, o.order_id)}
                        className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {busy === `issue-${o.order_id}` ? "발급 중..." : "수료증 발급"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {r.status !== "completed" && r.status !== "cancelled" ? (
                <button
                  type="button"
                  disabled={busy !== null || !confirmed || !allIssued}
                  onClick={() => send(r)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {allIssued ? "수료증 이메일 발송" : "모든 과정 수료증 발급 후 발송 가능"}
                </button>
              ) : null}
            </article>
          );
        })
      )}
    </div>
  );
}
