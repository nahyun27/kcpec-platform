"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { createOrderBundle, getCourseDetail, tokenStorage } from "@/lib/api";
import type { CourseDetail } from "@/types/course";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/types/order";
import { counselingDisplayTitle } from "@/types/counseling";
import {
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  Award,
  ChevronRight,
  ShieldCheck,
  Loader2,
  Landmark,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

function PaymentMethodIcon({
  method,
  selected,
}: {
  method: PaymentMethod;
  selected: boolean;
}) {
  if (method === "kakaopay") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#FEE500]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/kakao.svg" alt="" className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (method === "naverpay") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#03C75A]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/naver.svg" alt="" className="h-3.5 w-3.5" />
      </span>
    );
  }
  const cls = `h-6 w-6 ${selected ? "text-[var(--color-primary)]" : "text-slate-400"}`;
  if (method === "bank_transfer") return <Landmark className={cls} />;
  return <CreditCard className={cls} />;
}

const PAYMENT_METHODS: PaymentMethod[] = ["card", "kakaopay", "naverpay", "bank_transfer"];

// sentencing/page.tsx 의 BULK_DISCOUNT_* 와 동일 값 — 여기서는 결제 전 미리보기
// 표시용일 뿐, 실제 금액은 /orders/bundle 서버 응답이 최종 기준.
const BULK_DISCOUNT_THRESHOLD = 100_000;
const BULK_DISCOUNT_AMOUNT = 10_000;

export default function CheckoutBundleClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const coursesParam = searchParams.get("courses") ?? "";
  const courseIds = coursesParam
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
  const [courses, setCourses] = useState<CourseDetail[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentFailMessage, setPaymentFailMessage] = useState<string | null>(null);

  // 토스 결제창에서 실패/취소 시 failUrl(이 페이지 자체)로 code/message 를
  // 쿼리스트링에 실어 되돌아온다. 예전엔 이걸 그냥 무시해서, 사용자가
  // 왜 결제가 안 됐는지 전혀 모른 채 조용히 결제 폼으로만 돌아왔었다.
  useEffect(() => {
    const failMessage = searchParams.get("message");
    const failCode = searchParams.get("code");
    if (!failMessage && !failCode) return;
    setPaymentFailMessage(failMessage ?? "결제가 취소되었거나 실패했습니다.");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("code");
    params.delete("message");
    params.delete("orderId");
    router.replace(`/checkout/bundle?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (courseIds.length === 0) {
      setError("잘못된 접근입니다. (선택한 강의 없음)");
      setLoading(false);
      return;
    }
    if (!tokenStorage.getAccess()) {
      router.replace(
        `/login?next=${encodeURIComponent(`/checkout/bundle?courses=${coursesParam}`)}`,
      );
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all(courseIds.map((id) => getCourseDetail(id)))
      .then((list) => {
        if (!cancelled) setCourses(list);
      })
      .catch((err) => {
        if (cancelled) return;
        // 카드 인증(은행 ARS 등)에 오래 머물다 돌아오면 세션이 만료돼 있을
        // 수 있다 — 이 경우 그냥 에러로 막다른 화면을 보여주지 말고
        // 로그인 후 이 페이지로 되돌아오게 한다.
        if (isAxiosError(err) && err.response?.status === 401) {
          router.replace(
            `/login?next=${encodeURIComponent(`/checkout/bundle?courses=${coursesParam}`)}`,
          );
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
  }, [coursesParam, retryCount]);

  const subtotal = courses.reduce((sum, c) => sum + c.price, 0);
  const discount = subtotal >= BULK_DISCOUNT_THRESHOLD ? BULK_DISCOUNT_AMOUNT : 0;
  const total = subtotal - discount;

  async function handleCheckout() {
    if (courses.length === 0) return;
    setSubmitting(true);
    try {
      const bundle = await createOrderBundle({
        course_ids: courseIds,
        payment_method: paymentMethod,
      });

      if (paymentMethod === "bank_transfer") {
        router.push(`/checkout/pending?bundle_id=${bundle.bundle_id}`);
        return;
      }

      const tossClientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!tossClientKey) {
        router.push(
          `/checkout/bundle/success?bundle_id=${bundle.bundle_id}&amount=${bundle.total}&simulated=1`,
        );
        return;
      }

      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const toss = await loadTossPayments(tossClientKey);
      const widget = toss.payment({ customerKey: `kcpec-bundle-${bundle.bundle_id}` });
      // 카카오페이/네이버페이는 별도 method 가 아니라, method:"CARD" 에
      // card.flowMode:"DIRECT" + card.easyPay:"KAKAOPAY"/"NAVERPAY" 를
      // 실어 보내는 방식이다(토스 SDK v2 결제창 스펙). 예전엔
      // method:"EASY_PAY" + easyPay:{provider:...} 형태로 보냈는데 이건
      // 이 SDK 버전에 없는 필드라 요청 자체가 즉시 실패하고 있었다
      // (2026-09 발견 — "결제 진행에 실패했습니다" 즉시 에러).
      const easyPayCode =
        paymentMethod === "kakaopay"
          ? "KAKAOPAY"
          : paymentMethod === "naverpay"
            ? "NAVERPAY"
            : undefined;
      const orderName =
        bundle.items.length > 1
          ? `${counselingDisplayTitle(bundle.items[0].course_title)} 외 ${bundle.items.length - 1}건`
          : counselingDisplayTitle(bundle.items[0].course_title);

      // Toss orderId 형식 요건: 영문/숫자/-/_, 최소 6자 — 체크아웃 페이지와
      // 동일 규칙("KCPEC-BUNDLE-{bundle_id}"). 서버 확인(orders/bundle/toss/confirm)
      // 도 동일 형식으로 Toss confirm API 를 호출하므로 반드시 일치해야 함.
      await widget.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: bundle.total },
        orderId: `KCPEC-BUNDLE-${bundle.bundle_id}`,
        orderName,
        // courses 를 함께 실어 보내 — 카드 인증 중 취소(X) 등으로 승인이
        // 안 된 채 success 페이지로 넘어오는 경우에도, 그 페이지에서 이
        // 체크아웃(같은 강의 선택)으로 되돌아갈 수 있게 하기 위함.
        successUrl: `${window.location.origin}/checkout/bundle/success?courses=${coursesParam}`,
        failUrl: `${window.location.origin}/checkout/bundle?courses=${coursesParam}`,
        ...(easyPayCode ? { card: { flowMode: "DIRECT", easyPay: easyPayCode } } : {}),
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
  if (error || courses.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-600 shadow-sm">
          <p className="text-lg font-semibold">{error ?? "오류가 발생했습니다."}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setRetryCount((n) => n + 1);
              }}
              className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700"
            >
              다시 시도
            </button>
            <Link
              href="/sentencing"
              className="rounded-lg border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50"
            >
              강의 추천으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-white pt-10 md:pt-16 relative z-10 border-b border-slate-100">
        <div className="mx-auto max-w-5xl px-6">
          <Link
            href="/sentencing"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[var(--color-primary)]"
          >
            <ChevronLeft className="h-4 w-4" />
            다시 추천받기
          </Link>

          <PageHeader
            title="수강 신청·결제"
            subtitle="Enroll & Pay"
            icon={<Award className="h-3.5 w-3.5" />}
            description={
              <>
                선택하신 <span className="font-semibold text-slate-700">강의 {courses.length}건</span>을
                함께 결제합니다. 결제 완료 즉시 전부 수강을 시작할 수 있습니다.
              </>
            }
          />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 pt-8 md:pt-12">
        {paymentFailMessage ? (
          <div className="mb-8 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex-1">
              <p className="font-bold">결제에 실패했습니다</p>
              <p className="mt-0.5">{paymentFailMessage} 다시 시도해 주세요.</p>
            </div>
            <button
              type="button"
              onClick={() => setPaymentFailMessage(null)}
              className="shrink-0 text-xs font-bold text-red-500 hover:text-red-700"
            >
              닫기
            </button>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="space-y-12 lg:col-span-8">
            <section>
              <div className="mb-6 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">
                  1
                </div>
                <h2 className="font-sans text-xl font-bold text-slate-900">선택한 강의</h2>
              </div>
              <ul className="space-y-3">
                {courses.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4"
                  >
                    <span className="font-bold text-slate-800">
                      {counselingDisplayTitle(c.title)}
                    </span>
                    <span className="font-bold text-slate-600">
                      {c.price.toLocaleString()}원
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <div className="mb-6 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">
                  2
                </div>
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
                      <PaymentMethodIcon method={m} selected={selected} />
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

          <div className="lg:col-span-4">
            <div className="sticky top-28 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-slate-200/50">
              <div className="bg-slate-900 px-6 py-4">
                <h3 className="font-sans text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[var(--color-accent)]" /> 결제 요약
                </h3>
              </div>

              <div className="p-6">
                <div className="mb-6 space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between pb-2">
                    <span className="font-medium text-slate-500">강의 수</span>
                    <span className="font-bold text-slate-900">{courses.length}건</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-100 pb-4">
                    <span className="font-medium text-slate-500">소계</span>
                    <span className="font-bold text-slate-900">
                      {subtotal.toLocaleString()}원
                    </span>
                  </div>
                  {discount > 0 ? (
                    <div className="flex justify-between pb-2">
                      <span className="font-medium text-[var(--color-accent)]">
                        10만원 이상 할인
                      </span>
                      <span className="font-bold text-[var(--color-accent)]">
                        -{discount.toLocaleString()}원
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between pb-2">
                    <span className="font-medium text-slate-500">결제 수단</span>
                    <span className="font-bold text-slate-900">
                      {PAYMENT_METHOD_LABEL[paymentMethod]}
                    </span>
                  </div>
                </div>

                <div className="mb-6 rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-slate-700">총 결제 금액</span>
                    <span className="font-sans text-3xl font-black text-[var(--color-primary)]">
                      {total.toLocaleString()}
                      <span className="text-base font-bold text-slate-500 ml-1">원</span>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={submitting}
                  className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[var(--color-primary)] py-4 font-bold text-white shadow-lg shadow-[var(--color-primary)]/20 transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] hover:shadow-xl hover:shadow-[var(--color-primary)]/30 disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      처리 중...
                    </span>
                  ) : (
                    <>
                      <span>{total.toLocaleString()}원 결제하기</span>
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
