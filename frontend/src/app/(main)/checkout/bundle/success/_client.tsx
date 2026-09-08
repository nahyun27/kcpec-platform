"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { confirmBundleTossPayment } from "@/lib/api";
import type { OrderResponse } from "@/types/order";
import { counselingDisplayTitle } from "@/types/counseling";
import { useDialog } from "@/components/ui/DialogProvider";

export default function CheckoutBundleSuccessPage() {
  const router = useRouter();
  const dialog = useDialog();
  const searchParams = useSearchParams();
  // 카드 인증 중 취소(X)처럼 결제가 실제로 승인되지 않은 채 이 페이지로
  // 넘어오는 경우, 승인 실패 시 이 값으로 원래 체크아웃(같은 강의 선택)
  // 으로 되돌아간다.
  const coursesParam = searchParams.get("courses");
  const orderIdParam = searchParams.get("order_id") ?? searchParams.get("orderId");
  const paymentKey = searchParams.get("payment_key") ?? searchParams.get("paymentKey");
  const amountParam = searchParams.get("amount");
  const simulated = searchParams.get("simulated") === "1";
  // 시뮬레이션 모드에서는 직접 넘긴 bundle_id 를 사용. 실 결제는 Toss 가
  // successUrl 에 붙여주는 orderId("KCPEC-BUNDLE-{bundle_id}")에서 복원한다.
  const bundleIdFromQuery = searchParams.get("bundle_id");
  const bundleId =
    bundleIdFromQuery ?? orderIdParam?.replace(/^KCPEC-BUNDLE-/, "") ?? null;

  const [orders, setOrders] = useState<OrderResponse[] | null>(null);
  const ranRef = useRef(false);

  // 결제 승인 실패 시(카드 인증 중 X로 취소한 경우 등) 별도의 막다른 페이지
  // 대신 알림창으로 안내하고, 원래 체크아웃(같은 강의 선택)으로 돌려보낸다
  // — courses 파라미터가 없으면(직접 접근 등) 맞춤강의 추천으로 폴백.
  function backToCheckout() {
    router.push(coursesParam ? `/checkout/bundle?courses=${coursesParam}` : "/sentencing");
  }

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    if (!bundleId) {
      dialog
        .alert("잘못된 접근입니다. 다시 시도해 주세요.", { title: "결제 승인 실패" })
        .then(backToCheckout);
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
        dialog
          .alert(detail ?? "결제가 완료되지 않았습니다. 다시 시도해 주세요.", {
            title: "결제 승인 실패",
          })
          .then(backToCheckout);
      });
    // 한 번만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = orders?.reduce((sum, o) => sum + o.amount, 0) ?? 0;

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-lg border border-[var(--color-border)] bg-white p-8 text-center shadow-sm">
        {!orders ? (
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
                    {o.course_title ? counselingDisplayTitle(o.course_title) : `주문 #${o.id}`}
                  </span>
                  {o.order_type === "counseling" ? (
                    <Link
                      href={`/survey?counseling_order_id=${o.id}`}
                      className="font-bold text-[var(--color-accent)] hover:underline"
                    >
                      설문 작성하기 →
                    </Link>
                  ) : (
                    <Link
                      href={`/issue?order_id=${o.id}`}
                      className="font-bold text-[var(--color-accent)] hover:underline"
                    >
                      수료증 발급 →
                    </Link>
                  )}
                </li>
              ))}
            </ul>

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
