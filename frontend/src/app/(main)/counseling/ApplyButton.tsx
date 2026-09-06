"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isAxiosError } from "axios";
import { purchaseCounseling, tokenStorage } from "@/lib/api";
import type { CounselingType } from "@/types/counseling";

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
  const [submitting, setSubmitting] = useState(false);

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

  async function handleApply() {
    if (!tokenStorage.getAccess()) {
      router.push("/login?next=/counseling");
      return;
    }
    setSubmitting(true);
    try {
      const order = await purchaseCounseling(counselingType);
      const tossClientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

      if (!tossClientKey) {
        // 시뮬레이션 모드 — 결제창 없이 바로 success 로 이동
        router.push(
          `/checkout/success?order_id=${order.order_id}&simulated=1&amount=${order.amount}&next=/mypage?tab=counseling`,
        );
        return;
      }

      // 실제 토스 결제창 (체크아웃 페이지와 동일 패턴)
      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const toss = await loadTossPayments(tossClientKey);
      const widget = toss.payment({ customerKey: `user-counseling-${order.order_id}` });
      await widget.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: order.amount },
        // 서버 /orders/toss/confirm 이 항상 `KCPEC-{order.id}` 형식으로
        // Toss confirm API를 호출한다(체크아웃 페이지와 동일 규칙이어야 함).
        // 여기서 bare order_id 만 보내면 위젯이 등록한 orderId 와 서버가
        // confirm 시 보내는 orderId 가 달라 Toss 가 결제 승인을 거부해
        // 심리상담 결제가 전부 실패하고 있었다(2026-09 발견).
        orderId: `KCPEC-${order.order_id}`,
        orderName: `전문가 심리상담 - ${programTitle}`,
        successUrl: `${window.location.origin}/checkout/success?next=/mypage?tab=counseling`,
        failUrl: `${window.location.origin}/counseling`,
        // 위 unknown 캐스트는 토스 SDK 의 discriminated union 회피용 (체크아웃 페이지와 동일)
      } as never);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      alert(detail ?? "신청에 실패했습니다.");
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleApply}
      disabled={submitting}
      className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
    >
      {submitting ? "신청 처리 중..." : `${price.toLocaleString()}원 신청하기`}
    </button>
  );
}
