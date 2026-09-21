"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { confirmBundleTossPayment } from "@/lib/api";
import type { OrderResponse } from "@/types/order";
import { useDialog } from "@/components/ui/DialogProvider";
import { counselingDisplayTitle } from "@/types/counseling";
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
  // 같은 결제에 함께 담은 신청자 본인 수강/상담 주문(수용자용 주문과 구분).
  const ownOrders = orders?.filter((o) => !o.detention_inmate) ?? [];

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
                주세요. 확인 후 수료증이 발급되면 마이페이지에서 내려받으실 수 있습니다.
              </li>
            </ol>

            {ownOrders.length > 0 ? (
              <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-left text-sm text-blue-900">
                <p className="font-bold">신청하신 분 본인의 수강·상담</p>
                <ul className="mt-2 space-y-2">
                  {ownOrders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {o.course_title ? counselingDisplayTitle(o.course_title) : `주문 #${o.id}`}
                      </span>
                      {pendingDeposit ? (
                        <span className="text-xs text-blue-700">입금 확인 후 이용 가능</span>
                      ) : o.order_type === "counseling" ? (
                        <Link href={`/survey?counseling_order_id=${o.id}`} className="font-bold underline">
                          설문 작성하기 →
                        </Link>
                      ) : (
                        <Link href={`/courses/${o.course_id}/watch`} className="font-bold underline">
                          수강하기 →
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
            <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-left text-sm text-blue-900">
              <p className="font-bold">가족분도 함께 준비하시겠어요?</p>
              <p className="mt-1 text-xs leading-relaxed">
                신청하신 분 본인 명의로 재범방지교육을 수강하고 심리상담을 받으실 수 있습니다. 심리상담
                설문에서 수용자와의 관계를 입력하는 항목이 있습니다.
              </p>
              <div className="mt-3 flex gap-2">
                <Link href="/courses" className="rounded-md bg-white px-3 py-1.5 text-xs font-bold text-blue-800 ring-1 ring-blue-200 hover:bg-blue-100">
                  교육 수강하기
                </Link>
                <Link href="/counseling" className="rounded-md bg-white px-3 py-1.5 text-xs font-bold text-blue-800 ring-1 ring-blue-200 hover:bg-blue-100">
                  심리상담 신청하기
                </Link>
              </div>
            </div>
            )}

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
