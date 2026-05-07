"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { confirmTossPayment } from "@/lib/api";
import type { OrderResponse } from "@/types/order";

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("order_id") ?? searchParams.get("orderId");
  const paymentKey = searchParams.get("payment_key") ?? searchParams.get("paymentKey");
  const amountParam = searchParams.get("amount");
  const simulated = searchParams.get("simulated") === "1";

  // Toss 가 redirect 할 때 orderId 는 "KCPEC-{id}" 형식이므로 prefix 제거 후 숫자 변환.
  const orderId = orderIdParam
    ? Number(orderIdParam.replace(/^KCPEC-/, ""))
    : NaN;

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    if (!Number.isFinite(orderId)) {
      setError("잘못된 접근입니다. (order_id 누락)");
      return;
    }

    confirmTossPayment({
      order_id: orderId,
      payment_key: paymentKey ?? (simulated ? "SIMULATED" : ""),
      amount: amountParam ? Number(amountParam) : 0,
    })
      .then(setOrder)
      .catch((err) => {
        const detail = isAxiosError(err)
          ? (err.response?.data as { detail?: string } | undefined)?.detail
          : null;
        setError(detail ?? "결제 승인에 실패했습니다. 관리자에게 문의해 주세요.");
      });
    // 한 번만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-lg border border-[var(--color-border)] bg-white p-8 text-center shadow-sm">
        {error ? (
          <>
            <p className="font-sans text-2xl font-bold text-red-600">결제 승인 실패</p>
            <p className="mt-3 text-sm text-zinc-600">{error}</p>
            <Link
              href="/courses"
              className="mt-6 inline-block rounded bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
            >
              강의 목록으로
            </Link>
          </>
        ) : !order ? (
          <p className="text-sm text-zinc-500">결제 승인 처리 중...</p>
        ) : (
          <>
            <p className="font-sans text-2xl font-bold text-[var(--color-primary)]">
              결제가 완료되었습니다
            </p>
            <p className="mt-3 text-sm text-zinc-600">
              주문번호 #{order.id} · {order.amount.toLocaleString()}원
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {order.order_type === "counseling"
                ? "설문을 작성하시면 전문가가 검토 후 의견서를 발송해드립니다."
                : "이제 이수증을 발급받으실 수 있습니다."}
            </p>

            <div className="mt-8 flex flex-col gap-2">
              {order.order_type === "counseling" ? (
                <Link
                  href={`/survey?counseling_order_id=${order.id}`}
                  className="rounded bg-[var(--color-accent)] py-3 font-semibold text-white hover:bg-[var(--color-accent-hover)]"
                >
                  설문 작성하기
                </Link>
              ) : (
                <Link
                  href={`/issue?order_id=${order.id}`}
                  className="rounded bg-[var(--color-accent)] py-3 font-semibold text-white hover:bg-[var(--color-accent-hover)]"
                >
                  이수증 발급하기
                </Link>
              )}
              <Link
                href={order.order_type === "counseling" ? "/mypage" : "/courses"}
                className="rounded border border-[var(--color-border)] py-3 text-sm text-zinc-700 hover:border-[var(--color-primary)]"
              >
                {order.order_type === "counseling" ? "마이페이지로" : "강의 목록으로"}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
