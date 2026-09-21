"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { confirmBundleTossPayment } from "@/lib/api";
import type { OrderResponse } from "@/types/order";
import { useDialog } from "@/components/ui/DialogProvider";
import { VirtualAccountNotice } from "@/components/features/VirtualAccountNotice";

export default function DetentionSuccessClient() {
  const router = useRouter();
  const dialog = useDialog();
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("orderId");
  const paymentKey = searchParams.get("paymentKey");
  const amountParam = searchParams.get("amount");
  const simulated = searchParams.get("simulated") === "1";
  const bundleId =
    searchParams.get("bundle_id") ?? orderIdParam?.replace(/^KCPEC-BUNDLE-/, "") ?? null;

  const [orders, setOrders] = useState<OrderResponse[] | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    if (!bundleId || (!paymentKey && !simulated)) {
      dialog
        .alert("잘못된 접근입니다. 다시 시도해 주세요.", { title: "결제 승인 실패" })
        .then(() => router.push("/detention"));
      return;
    }

    confirmBundleTossPayment({
      bundle_id: bundleId,
      payment_key: paymentKey ?? "SIMULATED",
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
          .then(() => router.push("/detention"));
      });
    // 한 번만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = orders?.reduce((sum, o) => sum + o.amount, 0) ?? 0;
  const pendingDeposit = !!orders?.[0]?.va_account_number;

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-lg border border-[var(--color-border)] bg-white p-8 text-center shadow-sm">
        {!orders ? (
          <p className="text-sm text-zinc-500">결제 승인 처리 중...</p>
        ) : (
          <>
            <p className="font-sans text-2xl font-bold text-[var(--color-primary)]">
              {pendingDeposit ? "가상계좌가 발급되었습니다" : "신청과 결제가 완료되었습니다"}
            </p>
            <p className="mt-3 text-sm text-zinc-600">총 {total.toLocaleString()}원</p>

            {pendingDeposit ? <VirtualAccountNotice order={orders[0]} /> : null}

            <ol className="mt-6 space-y-2 rounded-lg bg-slate-50 p-4 text-left text-sm text-slate-700">
              <li>
                <b>1.</b> {pendingDeposit ? "입금이 확인되면 " : ""}교육자료를 기재하신 수용시설
                주소로 우편 발송합니다.
              </li>
              <li>
                <b>2.</b> 수용자께서 교육자료를 학습합니다. (교육자료 안에 퀴즈가 포함되어 있습니다.)
              </li>
              <li>
                <b>3.</b> 발송일로부터 7일이 지나면 마이페이지의 신청 내역에서 &apos;학습 완료 확인&apos;을 눌러
                주세요. 확인 후 수료증을 신청 시 입력하신 이메일로 보내드립니다.
              </li>
            </ol>

            <div className="mt-8 flex flex-col gap-2">
              <Link
                href="/detention/my"
                className="rounded bg-[var(--color-accent)] py-3 font-semibold text-white hover:bg-[var(--color-accent-hover)]"
              >
                신청 내역 보기
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
