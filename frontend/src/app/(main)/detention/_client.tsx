"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Loader2, Mail, PackageCheck, FileCheck2 } from "lucide-react";
import { applyDetention, getDetentionInfo, tokenStorage } from "@/lib/api";
import type { DetentionInfo } from "@/types/detention";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/types/order";

const PAYMENT_METHODS: PaymentMethod[] = ["card", "transfer", "bank_transfer"];

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[var(--color-primary)]";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-bold text-slate-700">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export default function DetentionClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [info, setInfo] = useState<DetentionInfo | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [form, setForm] = useState({
    inmate_name: "",
    inmate_birth: "",
    inmate_number: "",
    facility_name: "",
    postal_code: "",
    address: "",
    delivery_note: "",
    contact_phone: "",
    certificate_email: "",
  });
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDetentionInfo()
      .then(setInfo)
      .catch(() => setLoadError(true));
  }, []);

  // 토스 결제창에서 실패하면 failUrl(이 페이지)로 code/message 가 붙어 돌아온다.
  // 인증창을 X로 닫은 단순 취소는 조용히 무시한다.
  useEffect(() => {
    const code = searchParams.get("code");
    const message = searchParams.get("message");
    if (!code && !message) return;
    if (code !== "PAY_PROCESS_CANCELED") {
      setError(message ?? "결제가 취소되었거나 실패했습니다.");
    }
    router.replace("/detention");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const chosen = useMemo(
    () => (info?.courses ?? []).filter((c) => selected.includes(c.id)),
    [info, selected],
  );
  const coursesTotal = chosen.reduce((s, c) => s + c.price, 0);
  const fee = info?.fee_amount ?? 0;
  const subtotal = chosen.length > 0 ? coursesTotal + fee : 0;
  // 서버(/detention/apply) 와 동일 규칙 — 표시용일 뿐 최종 금액은 서버 응답 기준.
  const discount =
    info && subtotal >= info.bulk_discount_threshold ? info.bulk_discount_amount : 0;
  const total = subtotal - discount;

  function toggle(id: number) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!tokenStorage.getAccess()) {
      router.push(`/login?next=${encodeURIComponent("/detention")}`);
      return;
    }
    if (chosen.length === 0) {
      setError("신청할 교육과정을 1개 이상 선택해 주세요.");
      return;
    }
    if (!agree) {
      setError("개인정보 수집·이용에 동의해 주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const bundle = await applyDetention({
        course_ids: selected,
        payment_method: paymentMethod,
        ...form,
        postal_code: form.postal_code || undefined,
        delivery_note: form.delivery_note || undefined,
        agree_privacy: agree,
      });

      const tossClientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!tossClientKey) {
        router.push(
          `/detention/success?bundle_id=${bundle.bundle_id}&amount=${bundle.total}&simulated=1`,
        );
        return;
      }
      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const toss = await loadTossPayments(tossClientKey);
      const widget = toss.payment({ customerKey: `kcpec-bundle-${bundle.bundle_id}` });
      const tossMethod =
        paymentMethod === "bank_transfer"
          ? "VIRTUAL_ACCOUNT"
          : paymentMethod === "transfer"
            ? "TRANSFER"
            : "CARD";
      const orderName =
        chosen.length > 1
          ? `구속수용자 교육 (${chosen[0].title} 외 ${chosen.length - 1}건)`
          : `구속수용자 교육 (${chosen[0].title})`;
      await widget.requestPayment({
        method: tossMethod,
        amount: { currency: "KRW", value: bundle.total },
        orderId: `KCPEC-BUNDLE-${bundle.bundle_id}`,
        orderName,
        successUrl: `${window.location.origin}/detention/success`,
        failUrl: `${window.location.origin}/detention`,
      } as unknown as Parameters<typeof widget.requestPayment>[0]);
    } catch (err) {
      const c = (err as { code?: string; name?: string } | null) ?? {};
      const msg = err instanceof Error ? err.message : "";
      if (c.code === "USER_CANCEL" || c.name === "UserCancelError" || /사용자.*취소|결제창.*닫/.test(msg)) {
        setSubmitting(false);
        return;
      }
      if (isAxiosError(err) && err.response?.status === 401) {
        router.push(`/login?next=${encodeURIComponent("/detention")}`);
        return;
      }
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: unknown } | undefined)?.detail
        : null;
      setError(typeof detail === "string" ? detail : "신청 처리에 실패했습니다. 입력 내용을 확인해 주세요.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
            Detention Education
          </p>
          <h1 className="mt-2 font-sans text-3xl font-black text-slate-900">
            구속수용자 재범방지교육
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            구치소·교도소에 계셔서 온라인 수강이 어려운 분을 위해, 보호자께서 대신 신청하시면
            교육자료를 수용시설로 우편 발송해 드립니다. 교육 이수 후 수료증은 이메일로 발급해
            드립니다.
          </p>
          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { icon: FileCheck2, t: "1. 신청·결제", d: "수용자 정보 입력 후 결제" },
              { icon: PackageCheck, t: "2. 자료 발송", d: "교육자료를 수용시설로 우편 발송" },
              { icon: Mail, t: "3. 수료증 발송", d: "발송 후 약 1주 뒤 이메일로 발급" },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-slate-50 p-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]" />
                <div>
                  <p className="text-sm font-bold text-slate-800">{t}</p>
                  <p className="text-xs text-slate-500">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-10 px-6 pt-10">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <section className="space-y-4">
          <h2 className="font-sans text-xl font-bold text-slate-900">1. 교육과정 선택</h2>
          {loadError ? (
            <p className="text-sm text-red-600">과정 목록을 불러오지 못했습니다. 새로고침해 주세요.</p>
          ) : !info ? (
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {info.courses.map((c) => {
                const on = selected.includes(c.id);
                return (
                  <li key={c.id}>
                    <label
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-sm transition-colors ${
                        on
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                          : "border-zinc-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(c.id)}
                          className="h-4 w-4"
                        />
                        <span className="font-semibold text-slate-800">{c.title}</span>
                      </span>
                      <span className="shrink-0 font-bold text-slate-600">
                        {c.price.toLocaleString()}원
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-zinc-500">
            과정별 금액은 온라인 수강 금액과 같으며, 교육자료 제작·우편 발송비{" "}
            {fee.toLocaleString()}원이 1회 추가됩니다.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-sans text-xl font-bold text-slate-900">2. 수용자 정보</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="수용자 성명" required>
              <input className={inputCls} value={form.inmate_name} maxLength={100}
                onChange={(e) => set("inmate_name", e.target.value)} required />
            </Field>
            <Field label="수용자 생년월일" required>
              <input type="date" className={inputCls} value={form.inmate_birth}
                min="1900-01-01" max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => set("inmate_birth", e.target.value)} required />
            </Field>
            <Field label="수용번호" required hint="우편물 전달에 필요합니다.">
              <input className={inputCls} value={form.inmate_number} maxLength={50}
                onChange={(e) => set("inmate_number", e.target.value)} required />
            </Field>
            <Field label="수용시설명" required hint="예: 서울구치소, 수원구치소">
              <input className={inputCls} value={form.facility_name} maxLength={100}
                onChange={(e) => set("facility_name", e.target.value)} required />
            </Field>
            <Field label="우편번호">
              <input className={inputCls} value={form.postal_code} maxLength={10}
                onChange={(e) => set("postal_code", e.target.value)} />
            </Field>
            <Field label="수용시설 주소" required>
              <input className={inputCls} value={form.address} maxLength={300}
                onChange={(e) => set("address", e.target.value)} required />
            </Field>
            <div className="sm:col-span-2">
              <Field label="배송 요청사항" hint="시설 우편물 접수 관련 참고사항이 있으면 적어 주세요.">
                <input className={inputCls} value={form.delivery_note} maxLength={300}
                  onChange={(e) => set("delivery_note", e.target.value)} />
              </Field>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-sans text-xl font-bold text-slate-900">3. 신청자(보호자) 연락처</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="연락처" required>
              <input className={inputCls} value={form.contact_phone} maxLength={30}
                onChange={(e) => set("contact_phone", e.target.value)} required />
            </Field>
            <Field label="수료증 수신 이메일" required hint="수료증을 이 이메일로 보내드립니다.">
              <input type="email" className={inputCls} value={form.certificate_email}
                onChange={(e) => set("certificate_email", e.target.value)} required />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-sans text-xl font-bold text-slate-900">4. 결제</h2>
          <div className="grid grid-cols-3 gap-3">
            {PAYMENT_METHODS.map((m) => (
              <label
                key={m}
                className={`cursor-pointer rounded-xl border-2 p-3 text-center text-sm font-bold ${
                  paymentMethod === m
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]"
                    : "border-zinc-200 bg-white text-slate-600"
                }`}
              >
                <input type="radio" name="pm" className="sr-only" checked={paymentMethod === m}
                  onChange={() => setPaymentMethod(m)} />
                {PAYMENT_METHOD_LABEL[m]}
              </label>
            ))}
          </div>

          <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>교육과정 {chosen.length}건</span>
              <span className="font-bold text-slate-900">{coursesTotal.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>교육자료·발송비</span>
              <span className="font-bold text-slate-900">
                {(chosen.length > 0 ? fee : 0).toLocaleString()}원
              </span>
            </div>
            {discount > 0 ? (
              <div className="flex justify-between text-[var(--color-accent)]">
                <span>10만원 이상 할인</span>
                <span className="font-bold">-{discount.toLocaleString()}원</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-zinc-100 pt-3 text-base">
              <span className="font-bold text-slate-700">총 결제 금액</span>
              <span className="font-black text-[var(--color-primary)]">
                {total.toLocaleString()}원
              </span>
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 h-4 w-4" />
            <span>
              수용자의 성명·생년월일·수용번호·수용시설 정보를 교육자료 발송 및 수료증 발급
              목적으로 수집·이용하는 데 동의합니다.{" "}
              <Link href="/privacy" className="underline">
                개인정보처리방침
              </Link>
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting || !info}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] py-4 font-bold text-white shadow-lg transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> 처리 중...
              </>
            ) : (
              `${total.toLocaleString()}원 결제하기`
            )}
          </button>
          <p className="text-xs leading-relaxed text-zinc-500">
            교육자료는 결제 확인 후 영업일 기준 순차 발송되며, 수용시설 사정에 따라 도착까지
            시일이 걸릴 수 있습니다. 로그인이 필요합니다.
          </p>
        </section>
      </form>
    </div>
  );
}
