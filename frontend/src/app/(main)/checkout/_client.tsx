"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import {
  createOrder,
  getCourseDetail,
  getCourseProgress,
  getPackages,
  tokenStorage,
} from "@/lib/api";
import type { CourseDetail } from "@/types/course";
import {
  DOCUMENT_TYPE_LABEL,
  PAYMENT_METHOD_LABEL,
  type PackageWithDocuments,
  type PaymentMethod,
} from "@/types/order";

// 패키지 가격 (백엔드 packages.price 가 null 인 정책이라 프론트에서 결정)
// 운영 시에는 어드민 페이지에서 수정 가능하도록 옮길 예정.
const PACKAGE_PRICE: Record<string, number> = {
  basic: 110_000,
  standard: 220_000,
  premium: 550_000,
};

const PAYMENT_METHODS: PaymentMethod[] = ["card", "kakaopay", "naverpay", "bank_transfer"];

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseIdParam = searchParams.get("course_id");
  const courseId = courseIdParam ? Number(courseIdParam) : NaN;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [packages, setPackages] = useState<PackageWithDocuments[]>([]);
  const [selectedPkgId, setSelectedPkgId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(courseId)) {
      setError("잘못된 접근입니다. (course_id 누락)");
      setLoading(false);
      return;
    }
    if (!tokenStorage.getAccess()) {
      router.replace(`/login?next=/checkout?course_id=${courseId}`);
      return;
    }

    let cancelled = false;
    Promise.all([getCourseDetail(courseId), getCourseProgress(courseId), getPackages()])
      .then(([c, status, pkgs]) => {
        if (cancelled) return;
        if (!status.is_completed) {
          router.replace(`/courses/${courseId}/watch`);
          return;
        }
        setCourse(c);
        setPackages(pkgs);
        if (pkgs.length > 0) setSelectedPkgId(pkgs[0].id);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isAxiosError(err) && err.response?.status === 404) {
          router.replace(`/courses/${courseId}`);
          return;
        }
        setError("결제 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // router/searchParams omitted — only re-run on courseId change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const selectedPackage = useMemo(
    () => packages.find((p) => p.id === selectedPkgId) ?? null,
    [packages, selectedPkgId],
  );

  const amount = selectedPackage ? PACKAGE_PRICE[selectedPackage.tier] ?? 0 : 0;

  async function handleCheckout() {
    if (!selectedPackage || !course) return;
    setSubmitting(true);
    try {
      const order = await createOrder({
        course_id: course.id,
        package_id: selectedPackage.id,
        payment_method: paymentMethod,
        amount,
      });

      if (paymentMethod === "bank_transfer") {
        router.push(`/checkout/pending?order_id=${order.id}`);
        return;
      }

      const tossClientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!tossClientKey) {
        // 시뮬레이션 모드 — 결제창 없이 success 로 이동
        router.push(`/checkout/success?order_id=${order.id}&simulated=1`);
        return;
      }

      // 실제 토스 결제창 호출.
      // SDK 의 requestPayment 페이로드는 결제수단별 discriminated union 이라
      // 정확한 타이핑이 무거워, 여기서는 런타임만 검증하고 좁힌 cast 를 사용한다.
      // (TODO: 결제수단별로 분기해 정밀한 타입 헬퍼로 감싸기.)
      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const toss = await loadTossPayments(tossClientKey);
      const widget = toss.payment({ customerKey: `kcpec-${order.id}` });
      const tossMethod = paymentMethod === "card" ? "CARD" : "EASY_PAY";
      const easyPay =
        paymentMethod === "kakaopay"
          ? { provider: "KAKAOPAY" as const }
          : paymentMethod === "naverpay"
            ? { provider: "NAVERPAY" as const }
            : undefined;

      await widget.requestPayment({
        method: tossMethod,
        amount: { currency: "KRW", value: amount },
        orderId: String(order.id),
        orderName: `${course.title} (${selectedPackage.name})`,
        successUrl: `${window.location.origin}/checkout/success`,
        failUrl: `${window.location.origin}/checkout?course_id=${course.id}`,
        ...(easyPay ? { easyPay } : {}),
      } as unknown as Parameters<typeof widget.requestPayment>[0]);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "결제 진행에 실패했습니다.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>;
  }
  if (error || !course) {
    return <p className="py-20 text-center text-sm text-red-600">{error ?? "오류가 발생했습니다."}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href={`/courses/${courseId}`}
        className="mb-4 inline-block text-sm text-zinc-500 hover:text-[var(--color-primary)]"
      >
        ← 강의 상세
      </Link>

      <header className="mb-8 space-y-2">
        <p className="text-xs font-medium text-[var(--color-accent)]">{course.category}</p>
        <h1 className="font-serif text-2xl font-bold text-[var(--color-primary)]">
          {course.title} · 수료증 발급
        </h1>
        <p className="text-sm text-zinc-600">
          수료를 마치셨습니다. 발급받을 패키지와 결제 수단을 선택해 주세요.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 font-serif text-lg font-semibold text-[var(--color-primary)]">
          1. 패키지 선택
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {packages.map((pkg) => {
            const selected = selectedPkgId === pkg.id;
            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setSelectedPkgId(pkg.id)}
                className={`flex flex-col items-stretch gap-3 rounded-lg border-2 bg-white p-4 text-left transition-colors ${
                  selected
                    ? "border-[var(--color-primary)] shadow-md"
                    : "border-[var(--color-border)] hover:border-[var(--color-primary)]/40"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-lg font-bold text-[var(--color-primary)]">
                    {pkg.name}
                  </span>
                  <span className="text-sm font-semibold text-zinc-900">
                    {(PACKAGE_PRICE[pkg.tier] ?? 0).toLocaleString()}원
                  </span>
                </div>
                {pkg.description ? (
                  <p className="text-xs text-zinc-600">{pkg.description}</p>
                ) : null}
                <ul className="space-y-1 text-xs text-zinc-700">
                  {pkg.document_types.map((dt) => (
                    <li key={dt}>· {DOCUMENT_TYPE_LABEL[dt]}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-serif text-lg font-semibold text-[var(--color-primary)]">
          2. 결제 수단
        </h2>
        <div className="space-y-2">
          {PAYMENT_METHODS.map((m) => (
            <label
              key={m}
              className={`flex cursor-pointer items-center gap-3 rounded border px-4 py-3 text-sm ${
                paymentMethod === m
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                  : "border-[var(--color-border)] hover:border-[var(--color-primary)]/50"
              }`}
            >
              <input
                type="radio"
                name="payment_method"
                value={m}
                checked={paymentMethod === m}
                onChange={() => setPaymentMethod(m)}
                className="accent-[var(--color-primary)]"
              />
              <span>{PAYMENT_METHOD_LABEL[m]}</span>
            </label>
          ))}
        </div>
      </section>

      <div className="rounded-lg border border-[var(--color-border)] bg-white p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <span className="text-sm text-zinc-600">총 결제 금액</span>
          <span className="font-serif text-2xl font-bold text-[var(--color-primary)]">
            {amount.toLocaleString()}원
          </span>
        </div>
        <button
          type="button"
          onClick={handleCheckout}
          disabled={submitting || !selectedPackage}
          className="w-full rounded bg-[var(--color-primary)] py-3 font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
        >
          {submitting ? "처리 중..." : "결제하기"}
        </button>
        {!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY && paymentMethod !== "bank_transfer" ? (
          <p className="mt-2 text-center text-xs text-zinc-500">
            (토스 클라이언트 키 미설정 — 시뮬레이션 모드로 진행됩니다)
          </p>
        ) : null}
      </div>
    </div>
  );
}
