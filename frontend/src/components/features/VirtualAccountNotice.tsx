import { useState } from "react";
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
  // 입금기한이 지났는데도 아직 토스의 만료 웹훅이 반영되기 전인 짧은 틈에는
  // 죽은 계좌를 "입금해 주세요" 라고 그대로 안내하게 된다 — 만료 여부를
  // 직접 판단해 별도 경고로 바꿔준다(2026-09, 버그 감사 중 발견). 렌더 중
  // Date.now() 를 직접 부르면 impure 라 마운트 시점 값을 state 로 고정.
  const [now] = useState(() => Date.now());
  const isExpired = order.va_due_date ? new Date(order.va_due_date).getTime() < now : false;

  return (
    <div
      className={`mt-6 rounded-lg border p-5 text-left ${
        isExpired ? "border-red-200 bg-red-50" : "border-[var(--color-border)] bg-slate-50"
      }`}
    >
      <p
        className={`flex items-center gap-1.5 text-sm font-bold ${
          isExpired ? "text-red-700" : "text-slate-800"
        }`}
      >
        <Landmark className="h-4 w-4" />
        {isExpired ? "입금기한이 지난 계좌입니다" : "아래 계좌로 입금해 주세요"}
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
            <dd className={`font-semibold ${isExpired ? "text-red-700" : "text-slate-900"}`}>
              {dueDate}
            </dd>
          </div>
        ) : null}
      </dl>
      {isExpired ? (
        <p className="mt-3 text-xs font-medium text-red-600">
          이 계좌는 더 이상 입금에 사용할 수 없습니다. 잠시 후에도 상태가 바뀌지
          않으면 마이페이지에서 주문을 취소하고 다시 결제해 주세요.
        </p>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">
          {order.amount.toLocaleString()}원을 정확히 입금하시면 자동으로 결제가 확인되어
          수강 등록이 진행됩니다. 별도로 입금 확인 연락을 주실 필요는 없습니다.
        </p>
      )}
    </div>
  );
}
