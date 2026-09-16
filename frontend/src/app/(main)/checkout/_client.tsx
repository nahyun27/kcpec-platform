"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import {
  createOrder,
  getCourseDetail,
  tokenStorage,
} from "@/lib/api";
import type { CourseDetail } from "@/types/course";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/types/order";
import { ChevronLeft, Award, ChevronRight, ShieldCheck, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import type {
  TossPaymentsWidgets,
  WidgetPaymentMethodWidget,
  WidgetSelectedPaymentMethod,
} from "@tosspayments/tosspayments-sdk";

// 토스 결제위젯이 화면에 알려주는 결제수단 코드 → 우리 서버의 PaymentMethod.
// 위젯은 우리 가맹점에 실제 계약된 수단만 보여주므로(카드/계좌이체/가상계좌),
// 매핑에 없는 코드가 오면 일단 "card"로 처리한다(2026-09, 결제위젯 전환).
function mapWidgetMethodCode(code: WidgetSelectedPaymentMethod["code"]): PaymentMethod {
  switch (code) {
    case "TRANSFER":
      return "transfer";
    case "VIRTUAL_ACCOUNT":
      return "bank_transfer";
    case "MOBILE_PHONE":
      return "mobile_phone";
    case "KAKAOPAY":
      return "kakaopay";
    case "NAVERPAY":
      return "naverpay";
    case "SAMSUNGPAY":
      return "samsungpay";
    default:
      return "card";
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseIdParam = searchParams.get("course_id");
  const courseId = courseIdParam ? Number(courseIdParam) : NaN;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentFailMessage, setPaymentFailMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [widgetsReady, setWidgetsReady] = useState(false);
  const [selectedMethodLabel, setSelectedMethodLabel] = useState<string | null>(null);

  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);
  const paymentMethodWidgetRef = useRef<WidgetPaymentMethodWidget | null>(null);

  // 토스 결제창에서 실패/취소 시 failUrl(이 페이지 자체)로 code/message 를
  // 쿼리스트링에 실어 되돌아온다. 예전엔 이걸 그냥 무시해서, 사용자가
  // 왜 결제가 안 됐는지 전혀 모른 채 조용히 결제 폼으로만 돌아왔었다.
  // 다만 인증창을 X로 닫은 "단순 취소"(PAY_PROCESS_CANCELED)는 결제
  // 실패가 아니라 사용자의 정상적인 선택이므로, 이 경우엔 경고성 배너
  // 없이 그냥 조용히 결제 폼으로 돌려보낸다.
  useEffect(() => {
    const failMessage = searchParams.get("message");
    const failCode = searchParams.get("code");
    if (!failMessage && !failCode) return;
    if (failCode !== "PAY_PROCESS_CANCELED") {
      setPaymentFailMessage(failMessage ?? "결제가 취소되었거나 실패했습니다.");
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("code");
    params.delete("message");
    params.delete("orderId");
    router.replace(`/checkout?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setLoading(true);
    setError(null);
    getCourseDetail(courseId)
      .then((c) => {
        if (cancelled) return;
        setCourse(c);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isAxiosError(err) && err.response?.status === 404) {
          router.replace(`/courses/${courseId}`);
          return;
        }
        // 카드 인증(은행 ARS 등)에 오래 머물다 돌아오면 세션이 만료돼 있을
        // 수 있다 — 이 경우 그냥 에러로 막다른 화면을 보여주지 말고
        // 로그인 후 이 페이지로 되돌아오게 한다.
        if (isAxiosError(err) && err.response?.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(`/checkout?course_id=${courseId}`)}`);
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
  }, [courseId, retryCount]);

  const amount = course?.price ?? 0;

  // 결제위젯(카드/계좌이체/가상계좌 선택 UI)을 페이지 안에 직접 심는다 —
  // 예전 방식(우리가 만든 버튼 3개 → 토스 결제창 팝업 호출)은 카드를
  // 골라도 토스 쪽에서 "결제 방법을 선택해주세요" 화면이 한 번 더 떴는데,
  // 결제수단을 애초에 이 페이지 안에서 고르게 하면 그 재선택 화면 자체가
  // 없어진다(2026-09, 실사용 중 발견한 문제의 근본 해결).
  useEffect(() => {
    const tossClientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!course || !tossClientKey) return;

    let destroyed = false;

    async function init() {
      const { loadTossPayments, ANONYMOUS } = await import(
        "@tosspayments/tosspayments-sdk"
      );
      const toss = await loadTossPayments(tossClientKey as string);
      if (destroyed) return;
      const widgets = toss.widgets({ customerKey: ANONYMOUS });
      widgetsRef.current = widgets;

      await widgets.setAmount({ currency: "KRW", value: amount });
      if (destroyed) return;

      const paymentMethodWidget = await widgets.renderPaymentMethods({
        selector: "#toss-payment-method",
      });
      if (destroyed) return;
      paymentMethodWidgetRef.current = paymentMethodWidget;

      const selected = await paymentMethodWidget.getSelectedPaymentMethod();
      if (!destroyed) {
        setSelectedMethodLabel(PAYMENT_METHOD_LABEL[mapWidgetMethodCode(selected.code)]);
      }
      paymentMethodWidget.on("paymentMethodSelect", (m) => {
        setSelectedMethodLabel(PAYMENT_METHOD_LABEL[mapWidgetMethodCode(m.code)]);
      });

      await widgets.renderAgreement({ selector: "#toss-agreement" });
      if (destroyed) return;

      setWidgetsReady(true);
    }

    init().catch(() => {
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
  }, [course?.id]);

  async function handleCheckout() {
    if (!course) return;
    setSubmitting(true);
    setPaymentFailMessage(null);
    try {
      const tossClientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      const widgets = widgetsRef.current;
      const paymentMethodWidget = paymentMethodWidgetRef.current;

      // 개발 모드(테스트 키 미설정): 결제위젯 자체를 띄우지 않으므로 바로
      // 결제완료로 시뮬레이션한다. 결제수단 선택 UI가 없어 기본값 사용.
      if (!tossClientKey || !widgets || !paymentMethodWidget) {
        const order = await createOrder({
          course_id: course.id,
          payment_method: "card",
          amount,
        });
        router.push(
          `/checkout/success?order_id=${order.id}&amount=${amount}&simulated=1&course_id=${course.id}`,
        );
        return;
      }

      const selected = await paymentMethodWidget.getSelectedPaymentMethod();
      const method = mapWidgetMethodCode(selected.code);
      const order = await createOrder({
        course_id: course.id,
        payment_method: method,
        amount,
      });

      // Toss orderId 형식 요건: 영문/숫자/-/_, 최소 6자.
      // DB id 만으로는 너무 짧을 수 있어 "KCPEC-{id}" prefix 사용.
      await widgets.requestPayment({
        orderId: `KCPEC-${order.id}`,
        orderName: course.title,
        // course_id 를 함께 실어 보내 — 카드 인증 중 취소(X) 등으로 승인이
        // 안 된 채 success 페이지로 넘어오는 경우에도, 그 페이지에서 이
        // 체크아웃(같은 강의)으로 되돌아갈 수 있게 하기 위함.
        successUrl: `${window.location.origin}/checkout/success?course_id=${course.id}`,
        failUrl: `${window.location.origin}/checkout?course_id=${course.id}`,
      });
    } catch (err) {
      // 결제창에서 X 눌러 그냥 닫기만 해도 SDK가 UserCancelError(code:
      // "USER_CANCEL")를 던진다 — 이건 실패가 아니라 사용자의 정상적인
      // 취소라, failUrl 리다이렉트 경로의 PAY_PROCESS_CANCELED와 동일하게
      // 조용히 폼으로 돌아가야 한다. 이걸 걸러내지 않으면 결제창을
      // 열었다 닫기만 해도 매번 "결제에 실패했습니다" 배너가 뜬다
      // (2026-09, 실사용 중 발견).
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
      // 강의 조회 실패(치명적, 폼 전체를 에러 화면으로 대체)와 달리 결제
      // 시도 실패(토스 SDK 로드 실패/네트워크 오류 등)는 결제수단을 다시
      // 고를 필요 없이 그 자리에서 재시도할 수 있어야 하므로, 폼을
      // 지워버리는 error 대신 인라인 배너(paymentFailMessage)로 보여준다
      // (2026-09, 버그 감사 중 발견).
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setPaymentFailMessage(detail ?? "결제 진행에 실패했습니다.");
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
              href="/courses"
              className="rounded-lg border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50"
            >
              강의 목록으로 돌아가기
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
            href={`/courses/${courseId}`}
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[var(--color-primary)]"
          >
            <ChevronLeft className="h-4 w-4" />
            강의로 돌아가기
          </Link>

          <PageHeader
            title="수강 신청·결제"
            subtitle="Enroll & Pay"
            icon={<Award className="h-3.5 w-3.5" />}
            description={<><span className="font-semibold text-slate-700">{course.title}</span> 강의를 수강 신청합니다. 결제 완료 즉시 수강을 시작할 수 있습니다.</>}
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
          {/* Main Form (Left) */}
          <div className="space-y-12 lg:col-span-8">
            <section>
              <div className="mb-6 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">1</div>
                <h2 className="font-sans text-xl font-bold text-slate-900">결제 수단</h2>
              </div>
              {!widgetsReady && process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ? (
                <div className="flex h-40 items-center justify-center rounded-xl border border-zinc-200 bg-white">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                </div>
              ) : null}
              <div id="toss-payment-method" />
              <div id="toss-agreement" className="mt-4" />
              {!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                  개발 모드(토스 클라이언트 키 미설정) — 결제수단 선택 없이 바로 결제완료로 진행됩니다.
                </p>
              ) : null}
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
                    <span className="font-medium text-slate-500">선택 강의</span>
                    <span className="font-bold text-slate-900 text-right max-w-[200px] truncate">{course.title}</span>
                  </div>
                  {selectedMethodLabel ? (
                    <div className="flex justify-between pb-2">
                      <span className="font-medium text-slate-500">결제 수단</span>
                      <span className="font-bold text-slate-900">{selectedMethodLabel}</span>
                    </div>
                  ) : null}
                </div>

                <div className="mb-6 rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <div className="flex flex-col gap-1">
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
                  disabled={submitting || (!widgetsReady && Boolean(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY))}
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
