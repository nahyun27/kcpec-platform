import { Landmark } from "lucide-react";
import { bankNameFromCode } from "@/lib/bankCodes";
import type { OrderResponse } from "@/types/order";

/** 토스 가상계좌 발급 완료(입금 대기) 안내 — 체크아웃 완료 페이지/마이페이지 공용. */
export function VirtualAccountNotice({ order }: { order: OrderResponse }) {
  const dueDate = order.va_due_date
    ? new Date(order.va_due_date).toLocaleString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-slate-50 p-5 text-left">
      <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
        <Landmark className="h-4 w-4" /> 아래 계좌로 입금해 주세요
      </p>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">은행</dt>
          <dd className="font-semibold text-slate-900">
            {bankNameFromCode(order.va_bank_code)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">계좌번호</dt>
          <dd className="font-mono font-semibold text-slate-900">
            {order.va_account_number}
          </dd>
        </div>
        {order.va_customer_name ? (
          <div className="flex justify-between">
            <dt className="text-slate-500">예금주</dt>
            <dd className="font-semibold text-slate-900">{order.va_customer_name}</dd>
          </div>
        ) : null}
        {dueDate ? (
          <div className="flex justify-between">
            <dt className="text-slate-500">입금기한</dt>
            <dd className="font-semibold text-slate-900">{dueDate}</dd>
          </div>
        ) : null}
      </dl>
      <p className="mt-3 text-xs text-zinc-500">
        {order.amount.toLocaleString()}원을 정확히 입금하시면 자동으로 결제가 확인되어
        수강 등록이 진행됩니다. 별도로 입금 확인 연락을 주실 필요는 없습니다.
      </p>
    </div>
  );
}
