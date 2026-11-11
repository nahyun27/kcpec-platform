"use client";

import { useState } from "react";
import { isAxiosError } from "axios";
import { cancelRefundRequest, createRefundRequest, getRefundCheck } from "@/lib/api";
import { useDialog } from "@/components/ui/DialogProvider";
import type { OrderResponse, RefundCheck } from "@/types/order";

// 수강 전 강의 환불 신청(2026-11). 고객이 신청하면 관리자가 승인해야 실제
// 환불된다. 토스 가상계좌 결제 건은 환불받을 계좌를 함께 받는다.
type Status = OrderResponse["refund_request_status"];

function errDetail(err: unknown, fallback: string): string {
  const detail = isAxiosError(err)
    ? (err.response?.data as { detail?: unknown } | undefined)?.detail
    : null;
  return typeof detail === "string" ? detail : fallback;
}

// 같은 주문이 마이페이지 "내 강의실"과 "결제 내역" 양쪽에 그려지고 탭을 바꾸면
// 다시 마운트되므로, 한쪽에서 바꾼 상태를 다른 쪽이 이어받게 모듈에 기억해 둔다.
const overrides = new Map<number, { status: Status; eligible: boolean }>();

export function RefundRequestControl({ order }: { order: OrderResponse }) {
  const dialog = useDialog();
  const initial = overrides.get(order.id);
  const [status, setStatusState] = useState<Status>(
    initial ? initial.status : (order.refund_request_status ?? null),
  );
  const [eligible, setEligibleState] = useState(initial ? initial.eligible : !!order.refund_eligible);
  function remember(next: { status?: Status; eligible?: boolean }) {
    const cur = overrides.get(order.id) ?? { status, eligible };
    const merged = { ...cur, ...next };
    overrides.set(order.id, merged);
    if (next.status !== undefined) setStatusState(next.status);
    if (next.eligible !== undefined) setEligibleState(next.eligible);
  }
  const setEligible = (v: boolean) => remember({ eligible: v });
  const [check, setCheck] = useState<RefundCheck | null>(null);
  const [busy, setBusy] = useState(false);

  async function openForm() {
    setBusy(true);
    try {
      const c = await getRefundCheck(order.id);
      if (!c.eligible) {
        await dialog.alert(c.reason ?? "지금은 환불 신청을 할 수 없습니다.");
        setEligible(false);
        return;
      }
      setCheck(c);
    } catch (err) {
      await dialog.alert(errDetail(err, "환불 정보를 불러오지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!(await dialog.confirm("환불 신청을 취소할까요?"))) return;
    setBusy(true);
    try {
      await cancelRefundRequest(order.id);
      remember({ status: "cancelled", eligible: true });
    } catch (err) {
      await dialog.alert(errDetail(err, "신청 취소에 실패했습니다."));
    } finally {
      setBusy(false);
    }
  }

  if (status === "pending") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
        <span className="font-semibold text-amber-900">환불 신청 접수됨 · 확인 후 처리해 드려요</span>
        <button
          type="button"
          onClick={handleCancel}
          disabled={busy}
          className="font-semibold text-amber-800 underline underline-offset-2 disabled:opacity-50"
        >
          신청 취소
        </button>
      </div>
    );
  }

  return (
    <>
      {status === "rejected" && order.refund_reject_reason ? (
        <p className="text-xs text-slate-500">
          환불 신청이 처리되지 않았어요: {order.refund_reject_reason}
        </p>
      ) : null}
      {eligible ? (
        <div className="flex items-center justify-end gap-2 text-xs text-slate-400">
          <span>수강 전이라 환불할 수 있어요</span>
          <button
            type="button"
            onClick={openForm}
            disabled={busy}
            className="font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900 disabled:opacity-50"
          >
            환불 신청
          </button>
        </div>
      ) : null}
      {check ? (
        <RefundRequestModal
          order={order}
          check={check}
          onClose={() => setCheck(null)}
          onDone={() => {
            setCheck(null);
            remember({ status: "pending", eligible: false });
          }}
        />
      ) : null}
    </>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none";

function RefundRequestModal({
  order,
  check,
  onClose,
  onDone,
}: {
  order: OrderResponse;
  check: RefundCheck;
  onClose: () => void;
  onDone: () => void;
}) {
  const dialog = useDialog();
  const [reason, setReason] = useState("");
  const [bank, setBank] = useState("");
  const [account, setAccount] = useState("");
  const [holder, setHolder] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const digits = account.replace(/[^0-9]/g, "");
    if (check.needs_account) {
      if (!bank) return setError("은행을 선택해 주세요.");
      if (digits.length < 6) return setError("계좌번호를 정확히 입력해 주세요.");
      if (!holder.trim()) return setError("예금주를 입력해 주세요.");
    }
    setSubmitting(true);
    try {
      await createRefundRequest(order.id, {
        reason: reason.trim() || undefined,
        refund_account: check.needs_account
          ? { bank_code: bank, account_number: digits, holder_name: holder.trim() }
          : undefined,
      });
      onDone();
      await dialog.alert("환불 신청이 접수되었습니다. 확인 후 처리되면 이메일로 안내해 드려요.");
    } catch (err) {
      setError(errDetail(err, "환불 신청에 실패했습니다. 잠시 후 다시 시도해 주세요."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-sans text-lg font-bold text-slate-900">환불 신청</h2>
        <p className="mt-1 text-sm text-slate-500">{order.course_title}</p>

        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-600">환불 예정 금액</span>
            <span className="text-xl font-bold tabular-nums text-slate-900">
              {check.refund_amount.toLocaleString()}원
            </span>
          </div>
          {check.forfeited_discount > 0 ? (
            <p className="mt-1.5 text-xs leading-relaxed text-amber-700">
              함께 결제한 강의 금액이 10만원 미만이 되어 묶음 할인{" "}
              {check.forfeited_discount.toLocaleString()}원을 제외하고 환불됩니다.
            </p>
          ) : null}
          {order.bundle_id ? (
            <p className="mt-1.5 text-xs text-slate-500">함께 결제한 다른 강의는 그대로 유지돼요.</p>
          ) : null}
        </div>

        <div className="mt-4 space-y-4">
          {check.needs_account ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">환불받으실 계좌</p>
              <p className="text-xs text-slate-500">가상계좌로 결제하셔서 입력하신 계좌로 돌려드려요.</p>
              <select value={bank} onChange={(e) => setBank(e.target.value)} className={inputCls}>
                <option value="">은행 선택</option>
                {Object.entries(check.banks).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
              <input
                inputMode="numeric"
                placeholder="계좌번호 (숫자만)"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className={inputCls}
              />
              <input
                placeholder="예금주"
                value={holder}
                onChange={(e) => setHolder(e.target.value)}
                className={inputCls}
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-800">
              환불 사유 <span className="font-normal text-slate-400">(선택)</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="예: 강의를 잘못 선택했어요"
              className={`${inputCls} resize-none`}
            />
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            신청 후 확인을 거쳐 환불됩니다. 처리 전에 강의를 재생하면 환불이 어려울 수 있어요.
          </p>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {submitting ? "신청 중..." : "환불 신청하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
