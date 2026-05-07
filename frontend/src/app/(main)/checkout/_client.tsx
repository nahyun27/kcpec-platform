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
import { CheckCircle2, ChevronLeft, CreditCard, Award, ChevronRight, ShieldCheck, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

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
        router.push(
          `/checkout/success?order_id=${order.id}&amount=${amount}&simulated=1`,
        );
        return;
      }

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

      // Toss orderId 형식 요건: 영문/숫자/-/_, 최소 6자.
      // DB id 만으로는 너무 짧을 수 있어 "KCPEC-{id}" prefix 사용.
      await widget.requestPayment({
        method: tossMethod,
        amount: { currency: "KRW", value: amount },
        orderId: `KCPEC-${order.id}`,
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
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[var(--color-accent)]" />
          <p className="text-sm font-medium text-slate-500">결제 정보를 준비 중입니다...</p>
        </div>
      </div>
    );
  }
  if (error || !course) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-600 shadow-sm">
          <p className="text-lg font-semibold">{error ?? "오류가 발생했습니다."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] bg-slate-50 pb-24 pt-8">
      <div className="mx-auto max-w-5xl px-6">
        <Link
          href={`/courses/${courseId}`}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[var(--color-primary)]"
        >
          <ChevronLeft className="h-4 w-4" />
          강의로 돌아가기
        </Link>

        <PageHeader
          title="수료증 및 양형자료 발급"
          subtitle="수료 완료"
          icon={<Award className="h-3.5 w-3.5" />}
          description={<><span className="font-semibold text-slate-700">{course.title}</span> 과정을 수료하셨습니다. 필요한 패키지를 선택해 주세요.</>}
        />

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Main Form (Left) */}
          <div className="space-y-12 lg:col-span-8">
            <section>
              <div className="mb-6 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">1</div>
                <h2 className="font-sans text-xl font-bold text-slate-900">패키지 선택</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {packages.map((pkg) => {
                  const selected = selectedPkgId === pkg.id;
                  const price = PACKAGE_PRICE[pkg.tier] ?? 0;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setSelectedPkgId(pkg.id)}
                      className={`relative flex h-full flex-col items-stretch overflow-hidden rounded-2xl border-2 p-5 text-left transition-all duration-300 ${
                        selected
                          ? "border-[var(--color-primary)] bg-white shadow-xl shadow-slate-900/10 ring-1 ring-[var(--color-primary)]/10 scale-[1.02] z-10"
                          : "border-zinc-200 bg-white hover:border-slate-300 hover:shadow-md"
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-0 right-0 rounded-bl-xl bg-[var(--color-primary)] px-3 py-1 text-xs font-bold text-white">
                          선택됨
                        </div>
                      )}
                      <h3 className={`font-sans text-xl font-extrabold ${selected ? 'text-[var(--color-primary)]' : 'text-slate-700'}`}>
                        {pkg.name}
                      </h3>
                      <div className="my-2 border-b border-zinc-100 pb-2">
                        <span className="text-xl font-black text-slate-900">
                          {price.toLocaleString()}
                        </span>
                        <span className="text-xs font-medium text-slate-500 ml-0.5">원</span>
                      </div>
                      
                      <ul className="flex-1 space-y-2 mt-2">
                        {pkg.document_types.map((dt) => (
                          <li key={dt} className="flex items-start gap-1.5 text-xs font-medium text-slate-600">
                            <CheckCircle2 className={`h-4 w-4 shrink-0 ${selected ? 'text-[var(--color-accent)]' : 'text-slate-300'}`} />
                            <span className="mt-0.5 leading-snug">{DOCUMENT_TYPE_LABEL[dt]}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="mb-6 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">2</div>
                <h2 className="font-sans text-xl font-bold text-slate-900">결제 수단</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PAYMENT_METHODS.map((m) => {
                  const selected = paymentMethod === m;
                  return (
                    <label
                      key={m}
                      className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-200 ${
                        selected
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)] shadow-sm"
                          : "border-zinc-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment_method"
                        value={m}
                        checked={selected}
                        onChange={() => setPaymentMethod(m)}
                        className="sr-only"
                      />
                      <CreditCard className={`h-6 w-6 ${selected ? 'text-[var(--color-primary)]' : 'text-slate-400'}`} />
                      <span className="text-sm font-bold">{PAYMENT_METHOD_LABEL[m]}</span>
                      {selected && (
                        <div className="absolute top-2 right-2 text-[var(--color-primary)]">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Sticky Sidebar Summary (Right) */}
          <div className="lg:col-span-4">
            <div className="sticky top-28 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-slate-200/50">
              <div className="bg-slate-900 px-6 py-4">
                <h3 className="font-sans text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[var(--color-accent)]" /> 결제 요약
                </h3>
              </div>
              
              <div className="p-6">
                <div className="mb-6 space-y-4 text-sm text-slate-600">
                  <div className="flex justify-between border-b border-zinc-100 pb-4">
                    <span className="font-medium text-slate-500">선택 과정</span>
                    <span className="font-bold text-slate-900 text-right max-w-[200px] truncate">{course.title}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-100 pb-4">
                    <span className="font-medium text-slate-500">선택 패키지</span>
                    <span className="font-bold text-[var(--color-primary)]">{selectedPackage?.name ?? "-"}</span>
                  </div>
                  <div className="flex justify-between pb-2">
                    <span className="font-medium text-slate-500">결제 수단</span>
                    <span className="font-bold text-slate-900">{PAYMENT_METHOD_LABEL[paymentMethod]}</span>
                  </div>
                </div>

                <div className="mb-6 rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <div className="flex items-end justify-between">
                    <span className="text-sm font-bold text-slate-700">총 결제 금액</span>
                    <span className="font-sans text-3xl font-black text-[var(--color-primary)]">
                      {amount.toLocaleString()}
                      <span className="text-base font-bold text-slate-500 ml-1">원</span>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={submitting || !selectedPackage}
                  className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[var(--color-primary)] py-4 font-bold text-white shadow-lg shadow-[var(--color-primary)]/20 transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] hover:shadow-xl hover:shadow-[var(--color-primary)]/30 disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      처리 중...
                    </span>
                  ) : (
                    <>
                      <span>{amount.toLocaleString()}원 결제하기</span>
                      <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
                
                {!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY && paymentMethod !== "bank_transfer" ? (
                  <p className="mt-4 text-center text-xs font-medium text-amber-600 bg-amber-50 rounded-lg py-2">
                    개발 모드 (토스 클라이언트 키 미설정)
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
