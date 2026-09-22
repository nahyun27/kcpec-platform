"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { getLegalLetterInfo, getMyOrders, purchaseCounseling, tokenStorage } from "@/lib/api";
import { counselingDisplayTitle, type CounselingType } from "@/types/counseling";
import { LEGAL_LETTER_LABEL, type LegalLetterInfo, type LegalLetterType } from "@/types/legalLetter";
import { useDialog } from "@/components/ui/DialogProvider";

const LETTER_TYPES: LegalLetterType[] = ["repentance", "petition"];

// 반성문·탄원서 — 노출 위치 확정(전문가 심리상담 탭) 후 켬(2026-09).
const LEGAL_LETTERS_ENABLED = true;

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
  const [alreadyPurchased, setAlreadyPurchased] = useState(false);
  const [letterInfo, setLetterInfo] = useState<LegalLetterInfo | null>(null);
  const [selectedLetters, setSelectedLetters] = useState<LegalLetterType[]>([]);

  useEffect(() => {
    if (!tokenStorage.getAccess()) return;
    getMyOrders()
      .then((orders) => {
        const purchased = orders.some(
          (o) => o.status === "paid" && counselingDisplayTitle(o.course_title) === programTitle,
        );
        setAlreadyPurchased(purchased);
      })
      .catch(() => {});
  }, [programTitle]);

  // 가격 있는 프로그램에서만 반성문·탄원서 추가 옵션을 보여준다(문의 전용
  // 프로그램은 즉시결제 흐름 자체가 없어 묶을 수 없음).
  useEffect(() => {
    if (!LEGAL_LETTERS_ENABLED || price == null || price <= 0) return;
    getLegalLetterInfo()
      .then(setLetterInfo)
      .catch(() => {});
  }, [price]);

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

  function toggleLetter(t: LegalLetterType) {
    setSelectedLetters((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  const letterTotal = selectedLetters.reduce((sum, t) => {
    if (!letterInfo) return sum;
    return sum + (t === "repentance" ? letterInfo.repentance_price : letterInfo.petition_price);
  }, 0);
  const totalPrice = price + letterTotal;

  async function handleApply() {
    if (!tokenStorage.getAccess()) {
      router.push("/login?next=/counseling");
      return;
    }
    setSubmitting(true);
    try {
      const order = await purchaseCounseling(counselingType, selectedLetters);
      const tossClientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      // 반성문·탄원서를 함께 선택하면 서버가 묶음결제(bundle_id)로 만든다 —
      // 단건 결제(KCPEC-{id})가 아니라 묶음결제(KCPEC-BUNDLE-{bundle_id})
      // 흐름과 확인 페이지(/checkout/bundle/success)를 써야 한다.
      const isBundle = !!order.bundle_id;

      if (!tossClientKey) {
        // 시뮬레이션 모드 — 결제창 없이 바로 success 로 이동
        const url = isBundle
          ? `/checkout/bundle/success?bundle_id=${order.bundle_id}&amount=${order.amount}&simulated=1`
          : `/checkout/success?order_id=${order.order_id}&simulated=1&amount=${order.amount}&next=/mypage?tab=counseling`;
        router.push(url);
        return;
      }

      // 실제 토스 결제창 (체크아웃 페이지와 동일 패턴)
      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const toss = await loadTossPayments(tossClientKey);
      const widget = toss.payment({
        customerKey: isBundle ? `kcpec-bundle-${order.bundle_id}` : `user-counseling-${order.order_id}`,
      });
      const orderName = isBundle
        ? `전문가 심리상담 - ${programTitle} 외 ${selectedLetters.length}건`
        : `전문가 심리상담 - ${programTitle}`;
      await widget.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: order.amount },
        // 단건/묶음 모두 서버 confirm 이 orderId 형식으로 어느 쪽인지 판단한다
        // (체크아웃 페이지들과 동일 규칙 — KCPEC-{id} vs KCPEC-BUNDLE-{id}).
        // bare id 만 보내면 서버가 보내는 confirm 요청과 orderId 가 달라
        // 토스가 결제 승인을 거부한다(2026-09 발견, 단건 흐름에서 이미 한 번
        // 겪은 문제라 묶음 흐름에도 동일하게 주의).
        orderId: isBundle ? `KCPEC-BUNDLE-${order.bundle_id}` : `KCPEC-${order.order_id}`,
        orderName,
        successUrl: isBundle
          ? `${window.location.origin}/checkout/bundle/success`
          : `${window.location.origin}/checkout/success?next=/mypage?tab=counseling`,
        failUrl: `${window.location.origin}/counseling`,
        // 위 unknown 캐스트는 토스 SDK 의 discriminated union 회피용 (체크아웃 페이지와 동일)
      } as never);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      await dialog.alert(detail ?? "신청에 실패했습니다.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-6">
      {alreadyPurchased && (
        <p className="mb-2 text-center text-xs font-semibold text-[var(--color-primary)]">
          이미 신청하신 프로그램입니다 · 추가로 신청하실 수 있습니다
        </p>
      )}

      {letterInfo ? (
        <div className="mb-4 space-y-2 rounded-xl border border-dashed border-zinc-300 bg-slate-50/60 p-4">
          <p className="text-xs font-bold text-slate-500">
            함께 신청하기 <span className="font-normal text-zinc-400">(선택, AI가 답변을 바탕으로 자동 작성)</span>
          </p>
          {LETTER_TYPES.map((t) => {
            const letterPrice = t === "repentance" ? letterInfo.repentance_price : letterInfo.petition_price;
            const checked = selectedLetters.includes(t);
            return (
              <label
                key={t}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm shadow-sm"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleLetter(t)}
                    className="h-4 w-4"
                  />
                  <span className="font-semibold text-slate-700">
                    {LEGAL_LETTER_LABEL[t]} 작성
                  </span>
                </span>
                <span className="font-bold text-slate-500">+{letterPrice.toLocaleString()}원</span>
              </label>
            );
          })}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleApply}
        disabled={submitting}
        className="inline-flex w-full items-center justify-center rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
      >
        {submitting ? "신청 처리 중..." : `${totalPrice.toLocaleString()}원 신청하기`}
      </button>
    </div>
  );
}
