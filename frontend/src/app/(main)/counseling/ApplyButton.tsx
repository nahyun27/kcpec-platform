"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { purchaseCounseling, tokenStorage } from "@/lib/api";
import type { CounselingPurchaseResponse, CounselingType } from "@/types/counseling";
import { useDialog } from "@/components/ui/DialogProvider";
import { Loader2 } from "lucide-react";
import type { TossPaymentsWidgets, WidgetPaymentMethodWidget } from "@tosspayments/tosspayments-sdk";

export default function ApplyButton({
  counselingType,
  price,
  programTitle,
}: {
  counselingType: CounselingType;
  price: number | null;
  programTitle: string;
}) {
  const router = useRouter();
  const dialog = useDialog();
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<CounselingPurchaseResponse | null>(null);
  const [widgetsReady, setWidgetsReady] = useState(false);
  const [paymentFailMessage, setPaymentFailMessage] = useState<string | null>(null);

  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);
  const paymentMethodWidgetRef = useRef<WidgetPaymentMethodWidget | null>(null);
  const mountId = `toss-counseling-payment-method-${counselingType}`;
  const agreementId = `toss-counseling-agreement-${counselingType}`;

  // 결제수단 선택 UI(결제위젯)를 카드 안에 직접 심는다 — 체크아웃 페이지와
  // 동일한 이유(토스 결제창 팝업이 "결제 방법을 선택해주세요" 화면을 한 번
  // 더 띄우는 문제)로 동일한 패턴을 재사용한다(2026-09).
  useEffect(() => {
    const tossClientKey = process.env.NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY;
    if (!order || !tossClientKey) return;

    let destroyed = false;

    async function init() {
      const { loadTossPayments, ANONYMOUS } = await import(
        "@tosspayments/tosspayments-sdk"
      );
      const toss = await loadTossPayments(tossClientKey as string);
      if (destroyed) return;
      const widgets = toss.widgets({ customerKey: ANONYMOUS });
      widgetsRef.current = widgets;

      await widgets.setAmount({ currency: "KRW", value: order!.amount });
      if (destroyed) return;

      const paymentMethodWidget = await widgets.renderPaymentMethods({
        selector: `#${mountId}`,
      });
      if (destroyed) return;
      paymentMethodWidgetRef.current = paymentMethodWidget;

      await widgets.renderAgreement({ selector: `#${agreementId}` });
      if (destroyed) return;

      setWidgetsReady(true);
    }

    init().catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[counseling] 결제위젯 초기화 실패:", err);
      if (!destroyed) {
        setPaymentFailMessage("결제 UI를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.");
      }
    });

    return () => {
      destroyed = true;
      widgetsRef.current = null;
      paymentMethodWidgetRef.current = null;
      setWidgetsReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.order_id]);

  // 가격이 없는 프로그램(예: 대면 심화상담)은 별도 문의 — tel 링크 버튼.
  if (price == null || price <= 0) {
    return (
      <a
        href="tel:01063773325"
        className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-[var(--color-primary)] bg-white px-5 py-2.5 text-sm font-bold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)] hover:text-white"
      >
        상담 문의하기 (010-6377-3325)
      </a>
    );
  }

  async function handleStart() {
    if (!tokenStorage.getAccess()) {
      router.push("/login?next=/counseling");
      return;
    }
    setSubmitting(true);
    try {
      const created = await purchaseCounseling(counselingType);
      const tossClientKey = process.env.NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY;

      if (!tossClientKey) {
        // 시뮬레이션 모드 — 결제창 없이 바로 success 로 이동
        router.push(
          `/checkout/success?order_id=${created.order_id}&simulated=1&amount=${created.amount}&next=/mypage?tab=counseling`,
        );
        return;
      }

      setOrder(created);
      setSubmitting(false);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      await dialog.alert(detail ?? "신청에 실패했습니다.");
      setSubmitting(false);
    }
  }

  async function handlePay() {
    const widgets = widgetsRef.current;
    if (!order || !widgets) return;
    setSubmitting(true);
    setPaymentFailMessage(null);
    try {
      // 서버 /orders/toss/confirm 이 항상 `KCPEC-{order.id}` 형식으로 Toss
      // confirm API를 호출한다(체크아웃 페이지와 동일 규칙이어야 함).
      await widgets.requestPayment({
        orderId: `KCPEC-${order.order_id}`,
        orderName: `전문가 심리상담 - ${programTitle}`,
        successUrl: `${window.location.origin}/checkout/success?next=/mypage?tab=counseling`,
        failUrl: `${window.location.origin}/counseling`,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[counseling] 결제 요청 실패:", err);
      const codeOrName = (err as { code?: string; name?: string } | null) ?? {};
      const message = err instanceof Error ? err.message : "";
      const isUserCancel =
        codeOrName.code === "USER_CANCEL" ||
        codeOrName.name === "UserCancelError" ||
        /사용자.*취소|결제창.*닫/.test(message);
      if (isUserCancel) {
        setSubmitting(false);
        return;
      }
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      await dialog.alert(detail ?? "신청에 실패했습니다.");
      setSubmitting(false);
    }
  }

  if (order) {
    return (
      <div className="mt-6 space-y-4">
        {paymentFailMessage ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {paymentFailMessage}
          </p>
        ) : null}
        {!widgetsReady ? (
          <div className="flex h-32 items-center justify-center rounded-xl border border-zinc-200 bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : null}
        <div id={mountId} />
        <div id={agreementId} />
        <button
          type="button"
          onClick={handlePay}
          disabled={submitting || !widgetsReady}
          className="inline-flex w-full items-center justify-center rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
        >
          {submitting ? "결제 처리 중..." : `${price.toLocaleString()}원 결제하기`}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleStart}
      disabled={submitting}
      className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
    >
      {submitting ? "신청 처리 중..." : `${price.toLocaleString()}원 신청하기`}
    </button>
  );
}
