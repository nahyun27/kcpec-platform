"use client";

import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import {
  cancelRefundRequest,
  createBundleRefundRequest,
  createRefundRequest,
  getBundleRefundCheck,
  getRefundCheck,
} from "@/lib/api";
import { useDialog } from "@/components/ui/DialogProvider";
import type { BundleRefundCheck, OrderResponse, RefundAccountInput } from "@/types/order";
import { legalLetterTypeFromCourseTitle } from "@/types/legalLetter";

// 수강 전 강의 환불 신청(2026-11). 고객이 신청하면 관리자가 승인해야 실제
// 환불된다. 토스 가상계좌 결제 건은 환불받을 계좌를 함께 받는다.
// 반성문·탄원서는 작성 시작 전까지, 묶음결제는 신청 가능한 항목을 한 번에
// 신청할 수도 있다(BundleRefundControl).
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
const CHANGED_EVENT = "kcpec-refund-changed";

function markPending(orderIds: number[]) {
  for (const id of orderIds) overrides.set(id, { status: "pending", eligible: false });
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

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
    window.dispatchEvent(new Event(CHANGED_EVENT));
  }
  const setEligible = (v: boolean) => remember({ eligible: v });
  // 묶음 전체 신청으로 이 항목도 신청되면 바로 "접수됨"으로 바꾼다.
  useEffect(() => {
    const sync = () => {
      const o = overrides.get(order.id);
      if (o) {
        setStatusState(o.status);
        setEligibleState(o.eligible);
      }
    };
    window.addEventListener(CHANGED_EVENT, sync);
    return () => window.removeEventListener(CHANGED_EVENT, sync);
  }, [order.id]);
  const isLetter = !!legalLetterTypeFromCourseTitle(order.course_title);
  const [check, setCheck] = useState<ModalCheck | null>(null);
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
      setCheck({
        lines: [{ title: order.course_title ?? "", amount: c.refund_amount }],
        excluded: [],
        total: c.refund_amount,
        forfeited_discount: c.forfeited_discount,
        needs_account: c.needs_account,
        banks: c.banks,
        keepOthersNote: !!order.bundle_id,
      });
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
          <span>{isLetter ? "작성 전이라 환불할 수 있어요" : "수강 전이라 환불할 수 있어요"}</span>
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
          title="환불 신청"
          check={check}
          submit={(body) => createRefundRequest(order.id, body)}
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

type ModalCheck = {
  lines: { title: string; amount: number }[];
  excluded: { course_title: string; reason: string }[];
  total: number;
  forfeited_discount: number;
  needs_account: boolean;
  banks: Record<string, string>;
  keepOthersNote: boolean;
};

// 묶음결제에서 신청 가능한 항목을 한 번에 환불 신청(2026-11). 신청 가능한
// 항목이 2개 이상일 때만 보인다.
export function BundleRefundControl({ bundleId, orders }: { bundleId: string; orders: OrderResponse[] }) {
  const dialog = useDialog();
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    window.addEventListener(CHANGED_EVENT, f);
    return () => window.removeEventListener(CHANGED_EVENT, f);
  }, []);
  const [check, setCheck] = useState<ModalCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const eligibleCount = orders.filter((o) => {
    const ov = overrides.get(o.id);
    return o.status === "paid" && (ov ? ov.eligible : !!o.refund_eligible);
  }).length;
  if (eligibleCount < 2) return null;

  async function open() {
    setBusy(true);
    try {
      const c: BundleRefundCheck = await getBundleRefundCheck(bundleId);
      if (c.items.length === 0) {
        await dialog.alert("지금 환불 신청할 수 있는 항목이 없어요.");
        return;
      }
      setCheck({
        lines: c.items.map((i) => ({ title: i.course_title, amount: i.amount })),
        excluded: c.excluded,
        total: c.total,
        forfeited_discount: c.forfeited_discount,
        needs_account: c.needs_account,
        banks: c.banks,
        keepOthersNote: false,
      });
    } catch (err) {
      await dialog.alert(errDetail(err, "환불 정보를 불러오지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 px-6 py-4 text-sm">
      <span className="text-slate-500">아직 시작하지 않은 항목 {eligibleCount}개를 한 번에 환불 신청할 수 있어요.</span>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-[13px] font-bold text-slate-700 hover:border-slate-400 disabled:opacity-50"
      >
        묶음 전체 환불 신청
      </button>
      {check ? (
        <RefundRequestModal
          title="묶음 전체 환불 신청"
          check={check}
          submit={async (body) => {
            const reqs = await createBundleRefundRequest(bundleId, body);
            markPending(reqs.map((r) => r.order_id));
          }}
          onClose={() => setCheck(null)}
          onDone={() => setCheck(null)}
        />
      ) : null}
    </div>
  );
}

function RefundRequestModal({
  title,
  check,
  submit: submitRequest,
  onClose,
  onDone,
}: {
  title: string;
  check: ModalCheck;
  submit: (body: { reason?: string; refund_account?: RefundAccountInput }) => Promise<unknown>;
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
      await submitRequest({
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
        <h2 className="font-sans text-lg font-bold text-slate-900">{title}</h2>
        {check.lines.length === 1 ? (
          <p className="mt-1 text-sm text-slate-500">{check.lines[0].title}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {check.lines.map((l) => (
              <li key={l.title}>· {l.title}</li>
            ))}
          </ul>
        )}

        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-600">환불 예정 금액</span>
            <span className="text-xl font-bold tabular-nums text-slate-900">
              {check.total.toLocaleString()}원
            </span>
          </div>
          {check.forfeited_discount > 0 ? (
            <p className="mt-1.5 text-xs leading-relaxed text-amber-700">
              함께 결제한 강의 금액이 10만원 미만이 되어 묶음 할인{" "}
              {check.forfeited_discount.toLocaleString()}원을 제외하고 환불됩니다.
            </p>
          ) : null}
          {check.keepOthersNote ? (
            <p className="mt-1.5 text-xs text-slate-500">함께 결제한 다른 항목은 그대로 유지돼요.</p>
          ) : null}
          {check.excluded.length > 0 ? (
            <div className="mt-2 border-t border-slate-200 pt-2 text-xs leading-relaxed text-slate-500">
              <p className="font-semibold text-slate-600">이 신청에서 빠지는 항목</p>
              {check.excluded.map((e) => (
                <p key={e.course_title}>
                  · {e.course_title}: {e.reason}
                </p>
              ))}
            </div>
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
            신청 후 확인을 거쳐 환불됩니다. 처리 전에 강의를 재생하거나 서식을 작성하면 환불이 어려울 수 있어요.
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
