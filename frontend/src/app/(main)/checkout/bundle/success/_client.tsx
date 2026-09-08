"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { confirmBundleTossPayment } from "@/lib/api";
import type { OrderResponse } from "@/types/order";

export default function CheckoutBundleSuccessPage() {
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("order_id") ?? searchParams.get("orderId");
  const paymentKey = searchParams.get("payment_key") ?? searchParams.get("paymentKey");
  const amountParam = searchParams.get("amount");
  const simulated = searchParams.get("simulated") === "1";
  // 시뮬레이션 모드에서는 직접 넘긴 bundle_id 를 사용. 실 결제는 Toss 가
  // successUrl 에 붙여주는 orderId("KCPEC-BUNDLE-{bundle_id}")에서 복원한다.
  const bundleIdFromQuery = searchParams.get("bundle_id");
  const bundleId =
    bundleIdFromQuery ?? orderIdParam?.replace(/^KCPEC-BUNDLE-/, "") ?? null;
  const counseling = searchParams.get("counseling");

  const [orders, setOrders] = useState<OrderResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    if (!bundleId) {
      setError("잘못된 접근입니다. (bundle_id 누락)");
      return;
    }

    confirmBundleTossPayment({
      bundle_id: bundleId,
      payment_key: paymentKey ?? (simulated ? "SIMULATED" : ""),
      amount: amountParam ? Number(amountParam) : 0,
    })
      .then(setOrders)
      .catch((err) => {
        const detail = isAxiosError(err)
          ? (err.response?.data as { detail?: string } | undefined)?.detail
          : null;
        setError(detail ?? "결제 승인에 실패했습니다. 관리자에게 문의해 주세요.");
      });
    // 한 번만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = orders?.reduce((sum, o) => sum + o.amount, 0) ?? 0;

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
        ) : !orders ? (
          <p className="text-sm text-zinc-500">결제 승인 처리 중...</p>
        ) : (
          <>
            <p className="font-sans text-2xl font-bold text-[var(--color-primary)]">
              결제가 완료되었습니다
            </p>
            <p className="mt-3 text-sm text-zinc-600">
              강의 {orders.length}건 · 총 {total.toLocaleString()}원
            </p>

            <ul className="mt-6 space-y-2 text-left">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-100 bg-slate-50 px-4 py-3 text-sm"
                >
                  <span className="font-semibold text-slate-800">
                    {o.course_title ?? `주문 #${o.id}`}
                  </span>
                  <Link
                    href={`/issue?order_id=${o.id}`}
                    className="font-bold text-[var(--color-accent)] hover:underline"
                  >
                    수료증 발급 →
                  </Link>
                </li>
              ))}
            </ul>

            {counseling ? (
              <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
                <p className="text-sm font-bold text-amber-800">
                  심리상담 의견서는 이 결제에 포함되지 않았어요
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  선택하신 심리상담은 별도 결제가 필요합니다. 아래 버튼으로 이어서 신청해 주세요.
                </p>
                <Link
                  href={`/counseling#${counseling}`}
                  className="mt-3 inline-block rounded-full bg-amber-600 px-5 py-2 text-sm font-bold text-white hover:bg-amber-700"
                >
                  심리상담 이어서 신청하기 →
                </Link>
              </div>
            ) : null}

            <div className="mt-8 flex flex-col gap-2">
              <Link
                href="/mypage"
                className="rounded bg-[var(--color-accent)] py-3 font-semibold text-white hover:bg-[var(--color-accent-hover)]"
              >
                마이페이지로
              </Link>
              <Link
                href="/courses"
                className="rounded border border-[var(--color-border)] py-3 text-sm text-zinc-700 hover:border-[var(--color-primary)]"
              >
                강의 목록으로
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
