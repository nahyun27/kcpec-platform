"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { confirmTossPayment } from "@/lib/api";
import type { OrderResponse } from "@/types/order";
import { useDialog } from "@/components/ui/DialogProvider";

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const dialog = useDialog();
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("order_id") ?? searchParams.get("orderId");
  const paymentKey = searchParams.get("payment_key") ?? searchParams.get("paymentKey");
  const amountParam = searchParams.get("amount");
  const simulated = searchParams.get("simulated") === "1";
  // 카드 인증 중 취소(X)처럼 결제가 실제로 승인되지 않은 채 이 페이지로
  // 넘어오는 경우, 승인 실패 시 이 값으로 원래 체크아웃(같은 강의)으로
  // 되돌아간다.
  const courseIdParam = searchParams.get("course_id");

  // Toss 가 redirect 할 때 orderId 는 "KCPEC-{id}" 형식이므로 prefix 제거 후 숫자 변환.
  const orderId = orderIdParam
    ? Number(orderIdParam.replace(/^KCPEC-/, ""))
    : NaN;

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const ranRef = useRef(false);

  // 결제 승인 실패 시(카드 인증 중 X로 취소한 경우 등) 별도의 막다른 페이지
  // 대신 알림창으로 안내하고, 원래 체크아웃(같은 강의)으로 돌려보낸다 —
  // course_id 가 없으면(직접 접근 등) 강의 목록으로 폴백.
  function backToCheckout() {
    router.push(courseIdParam ? `/checkout?course_id=${courseIdParam}` : "/courses");
  }

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    if (!Number.isFinite(orderId)) {
      dialog
        .alert("잘못된 접근입니다. 다시 시도해 주세요.", { title: "결제 승인 실패" })
        .then(backToCheckout);
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
        dialog
          .alert(detail ?? "결제가 완료되지 않았습니다. 다시 시도해 주세요.", {
            title: "결제 승인 실패",
          })
          .then(backToCheckout);
      });
    // 한 번만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-lg border border-[var(--color-border)] bg-white p-8 text-center shadow-sm">
        {!order ? (
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
                : "이제 수료증을 발급받으실 수 있습니다."}
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
                  수료증 발급하기
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
