"use client";

import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import {
  approveAdminRefundRequest,
  getAdminRefundRequests,
  rejectAdminRefundRequest,
} from "@/lib/api";
import type { AdminRefundRequestRow, RefundRequestStatus } from "@/types/admin";
import { PAYMENT_METHOD_LABEL } from "@/types/order";
import { useDialog } from "@/components/ui/DialogProvider";

// 고객 환불 신청(2026-11) — 수강 전 강의를 고객이 신청하면 여기서 승인/거절한다.
// 승인하면 주문 화면의 "환불"과 같은 처리가 실행된다(카드는 자동 취소,
// 가상계좌는 고객이 입력한 계좌로 토스가 자동 입금).

const FILTERS: { value: RefundRequestStatus | "all"; label: string }[] = [
  { value: "pending", label: "대기" },
  { value: "approved", label: "승인" },
  { value: "rejected", label: "거절" },
  { value: "cancelled", label: "고객 취소" },
  { value: "all", label: "전체" },
];

const STATUS_LABEL: Record<RefundRequestStatus, string> = {
  pending: "대기",
  approved: "환불 완료",
  rejected: "거절",
  cancelled: "고객 취소",
};

const STATUS_CLS: Record<RefundRequestStatus, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  cancelled: "bg-slate-100 text-slate-500 ring-slate-200",
};

function errDetail(err: unknown, fallback: string): string {
  const d = isAxiosError(err) ? (err.response?.data as { detail?: unknown } | undefined)?.detail : null;
  return typeof d === "string" ? d : fallback;
}

export default function AdminRefundsPage() {
  const dialog = useDialog();
  const [filter, setFilter] = useState<RefundRequestStatus | "all">("pending");
  const [rows, setRows] = useState<AdminRefundRequestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<AdminRefundRequestRow | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getAdminRefundRequests(filter === "all" ? undefined : filter);
      setError(null);
      setRows(data);
    } catch (err) {
      setError(errDetail(err, "목록을 불러오지 못했습니다."));
    }
  }, [filter]);

  useEffect(() => {
    let alive = true;
    getAdminRefundRequests(filter === "all" ? undefined : filter)
      .then((data) => {
        if (!alive) return;
        setError(null);
        setRows(data);
      })
      .catch((err) => alive && setError(errDetail(err, "목록을 불러오지 못했습니다.")));
    return () => {
      alive = false;
    };
  }, [filter]);

  async function approve(r: AdminRefundRequestRow) {
    const amount = r.current_amount ?? r.expected_amount;
    const how = r.is_virtual_account
      ? `고객이 입력한 계좌(${r.bank_name} ${r.account_number_masked}, ${r.holder_name})로 토스가 자동 입금합니다.`
      : "토스 결제가 자동으로 취소되어 고객에게 환불됩니다.";
    const changed =
      r.current_amount != null && r.current_amount !== r.expected_amount
        ? `\n\n※ 신청 때 안내된 금액(${r.expected_amount.toLocaleString()}원)과 달라졌어요.`
        : "";
    if (
      !(await dialog.confirm(
        `${r.course_title}: ${amount.toLocaleString()}원을 환불합니다.\n(${r.name ?? r.username}, 주문 #${r.order_id})\n\n${how}${changed}`,
        { title: "환불을 승인할까요?", confirmText: "승인하고 환불", cancelText: "돌아가기" },
      ))
    )
      return;
    setBusyId(r.id);
    try {
      try {
        await approveAdminRefundRequest(r.id);
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 409) {
          const ok = await dialog.confirm(
            `${errDetail(err, "")}\n\n그래도 환불하시겠어요?`,
            { title: "수강을 시작한 고객이에요", confirmText: "그래도 환불", cancelText: "돌아가기" },
          );
          if (!ok) return;
          await approveAdminRefundRequest(r.id, true);
        } else {
          throw err;
        }
      }
      await dialog.alert("환불이 완료되었습니다. 고객에게 안내 메일이 발송됩니다.");
      await load();
    } catch (err) {
      await dialog.alert(errDetail(err, "환불 처리에 실패했습니다."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">환불 신청</h1>
        <p className="mt-1 text-sm text-slate-500">
          고객이 마이페이지에서 신청한 수강 전 강의 환불입니다. 승인하면 바로 환불되고 고객에게 메일이 갑니다.
        </p>
      </header>

      <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100/80 p-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              if (f.value === filter) return;
              setRows(null);
              setFilter(f.value);
            }}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              filter === f.value
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="py-10 text-center text-sm text-red-600">{error}</p>
      ) : !rows ? (
        <p className="py-10 text-center text-sm text-zinc-500">불러오는 중...</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">해당하는 환불 신청이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${STATUS_CLS[r.status]}`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                    <span className="text-[15px] font-bold text-slate-900">{r.course_title}</span>
                    {r.bundle ? (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">묶음결제</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[13px] text-slate-500">
                    {r.name ? `${r.name} · ` : ""}
                    {r.username} · 주문 #{r.order_id} ·{" "}
                    {r.is_virtual_account ? "가상계좌" : PAYMENT_METHOD_LABEL[r.payment_method]} · 신청{" "}
                    {new Date(r.created_at).toLocaleString("ko-KR")}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold tabular-nums text-slate-900">
                    {(r.current_amount ?? r.expected_amount).toLocaleString()}원
                  </div>
                  <div className="text-[11px] text-slate-400">결제액 {r.paid_amount.toLocaleString()}원</div>
                </div>
              </div>

              <dl className="mt-3 grid gap-x-4 gap-y-1 text-[13px] sm:grid-cols-[auto_1fr]">
                <dt className="text-slate-400">사유</dt>
                <dd className="text-slate-700">{r.reason ?? "-"}</dd>
                {r.is_virtual_account ? (
                  <>
                    <dt className="text-slate-400">환불계좌</dt>
                    <dd className="text-slate-700">
                      {r.bank_name ?? "-"} {r.account_number_masked ?? "(처리 후 삭제됨)"} · {r.holder_name ?? "-"}
                    </dd>
                  </>
                ) : null}
                {r.reject_reason ? (
                  <>
                    <dt className="text-slate-400">거절 사유</dt>
                    <dd className="text-slate-700">{r.reject_reason}</dd>
                  </>
                ) : null}
              </dl>

              {r.started_since_request ? (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800">
                  신청 후 고객이 강의를 재생했어요. 환불 여부를 확인해 주세요.
                </p>
              ) : null}

              {r.status === "pending" ? (
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRejecting(r)}
                    disabled={busyId === r.id}
                    className="rounded-md border border-slate-200 px-3.5 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    거절
                  </button>
                  <button
                    type="button"
                    onClick={() => approve(r)}
                    disabled={busyId === r.id}
                    className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-[12px] font-bold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
                  >
                    {busyId === r.id ? "처리 중..." : "승인하고 환불"}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {rejecting ? (
        <RejectModal
          row={rejecting}
          onClose={() => setRejecting(null)}
          onDone={async () => {
            setRejecting(null);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function RejectModal({
  row,
  onClose,
  onDone,
}: {
  row: AdminRefundRequestRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason.trim()) {
      setError("거절 사유를 입력해 주세요. 고객에게 메일로 안내됩니다.");
      return;
    }
    setSubmitting(true);
    try {
      await rejectAdminRefundRequest(row.id, reason.trim());
      onDone();
    } catch (err) {
      setError(errDetail(err, "처리에 실패했습니다."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900">환불 거절</h2>
        <p className="mt-1 text-sm text-slate-500">
          {row.course_title} · {row.name ?? row.username}
        </p>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="예: 이미 수강을 시작한 강의라 환불이 어렵습니다."
          className="mt-4 w-full resize-none rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
        />
        <p className="mt-1 text-xs text-slate-400">입력한 사유는 고객에게 메일과 마이페이지로 안내됩니다.</p>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {submitting ? "처리 중..." : "거절하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
