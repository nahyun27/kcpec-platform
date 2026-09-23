"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { CheckCircle2, Download, FileText, Loader2, Sparkles } from "lucide-react";
import { absUrl, getLegalLetterInfo, getLegalLetterStatus, submitLegalLetter, tokenStorage } from "@/lib/api";
import { LEGAL_LETTER_LABEL, type LegalLetterInfo, type LegalLetterStatus } from "@/types/legalLetter";

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

function YesNoToggle({
  value,
  onChange,
  yesLabel = "예",
  noLabel = "아니오",
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
}) {
  return (
    <div className="flex gap-2">
      {[
        { v: true, label: yesLabel },
        { v: false, label: noLabel },
      ].map(({ v, label }) => (
        <label
          key={label}
          className={`flex-1 cursor-pointer rounded-lg border-2 px-3 py-2.5 text-center text-sm font-bold transition-colors ${
            value === v
              ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]"
              : "border-zinc-200 bg-white text-slate-600"
          }`}
        >
          <input type="radio" className="sr-only" checked={value === v} onChange={() => onChange(v)} />
          {label}
        </label>
      ))}
    </div>
  );
}

export default function LegalLetterClient({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<LegalLetterStatus | null>(null);
  const [info, setInfo] = useState<LegalLetterInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    case_number: "",
    charge: "",
    court_name: "",
    writer_name: "",
    writer_birth: "",
    writer_address: "",
    writer_phone: "",
    defendant_name: "",
    relationship: "",
    case_stage: "",
    settlement_status: "",
  });
  const [firstOffense, setFirstOffense] = useState<boolean | null>(null);
  const [priorSameType, setPriorSameType] = useState<boolean | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!tokenStorage.getAccess()) {
      router.replace(`/login?next=${encodeURIComponent(`/legal-letters/${orderId}`)}`);
      return;
    }
    if (!Number.isFinite(orderId)) {
      setLoadError("잘못된 접근입니다.");
      return;
    }
    Promise.all([getLegalLetterStatus(orderId), getLegalLetterInfo()])
      .then(([s, i]) => {
        setStatus(s);
        setInfo(i);
        const labels = s.letter_type === "petition" ? i.petition_questions : i.repentance_questions;
        setAnswers(Object.fromEntries(Object.keys(labels).map((k) => [k, ""])));
      })
      .catch((err) => {
        const detail = isAxiosError(err)
          ? (err.response?.data as { detail?: string } | undefined)?.detail
          : null;
        setLoadError(detail ?? "정보를 불러오지 못했습니다.");
      });
  }, [orderId, router]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!status) return;
    setError(null);
    setSubmitting(true);
    try {
      const isPetition = status.letter_type === "petition";
      const updated = await submitLegalLetter(orderId, {
        case_number: form.case_number || undefined,
        charge: form.charge,
        court_name: form.court_name,
        writer_name: form.writer_name,
        writer_birth: form.writer_birth,
        writer_address: form.writer_address || undefined,
        writer_phone: form.writer_phone || undefined,
        defendant_name: isPetition ? form.defendant_name : undefined,
        relationship: isPetition ? form.relationship : undefined,
        first_offense: isPetition ? undefined : firstOffense ?? undefined,
        prior_same_type_record: isPetition || firstOffense !== false ? undefined : priorSameType ?? undefined,
        case_stage: isPetition ? undefined : form.case_stage || undefined,
        settlement_status: isPetition ? undefined : form.settlement_status || undefined,
        answers,
      });
      setStatus(updated);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: unknown } | undefined)?.detail
        : null;
      setError(
        typeof detail === "string" ? detail : "제출에 실패했습니다. 입력 내용을 확인해 주세요.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-sm text-red-600">{loadError}</p>
        <Link href="/mypage" className="mt-4 inline-block text-sm font-bold text-[var(--color-accent)] underline">
          마이페이지로
        </Link>
      </div>
    );
  }

  if (!status || !info) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!status.paid) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-sm text-slate-600">결제가 완료된 주문만 작성할 수 있습니다.</p>
        <Link href="/mypage" className="mt-4 inline-block text-sm font-bold text-[var(--color-accent)] underline">
          마이페이지로
        </Link>
      </div>
    );
  }

  const label = LEGAL_LETTER_LABEL[status.letter_type];
  const isPetition = status.letter_type === "petition";
  const questionLabels = isPetition ? info.petition_questions : info.repentance_questions;

  if (status.submitted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <p className="mt-4 font-sans text-xl font-bold text-emerald-900">
            {label}가 작성되었습니다
          </p>
          <p className="mt-2 text-sm text-emerald-800">
            입력하신 답변을 바탕으로 AI가 본문을 작성해 서식에 정리했습니다. 제출 전에 꼭 한 번
            읽어보시고, 필요하면 출력해 자필로 서명해 제출해 주세요.
          </p>
          {status.pdf_url ? (
            <a
              href={absUrl(status.pdf_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-[var(--color-primary-hover)]"
            >
              <Download className="h-4 w-4" />
              {label} PDF 다운로드
            </a>
          ) : null}
          <div className="mt-6">
            <Link href="/mypage" className="text-sm font-bold text-emerald-800 underline">
              마이페이지로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 flex items-center gap-2">
        <FileText className="h-6 w-6 text-[var(--color-primary)]" />
        <h1 className="font-sans text-2xl font-bold text-slate-900">{label} 작성</h1>
      </div>
      <div className="mb-8 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <p className="text-sm leading-relaxed text-blue-900">
          아래 항목에 답해 주시면 AI가 답변을 바탕으로 {label} 본문을 자동으로 작성합니다. 입력하지
          않은 내용을 임의로 지어내지 않으니, 최대한 구체적으로 적어 주세요.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">사건 정보</h2>
          <Field label="사건번호" hint="수사 단계에서는 접수번호를 적거나 비워 두어도 됩니다.">
            <input className={inputCls} value={form.case_number} maxLength={100}
              onChange={(e) => set("case_number", e.target.value)} />
          </Field>
          {isPetition ? (
            <Field label="사건당사자 성명" required>
              <input className={inputCls} value={form.defendant_name} maxLength={100} required
                onChange={(e) => set("defendant_name", e.target.value)} />
            </Field>
          ) : null}
          <Field label="죄명" required>
            <input className={inputCls} value={form.charge} maxLength={200} required
              onChange={(e) => set("charge", e.target.value)} />
          </Field>
          <Field label="관할명" required hint="예: 서울중앙지방법원, 서울중앙지방검찰청, ○○경찰서 등 — 경찰/검찰/법원 중 현재 사건을 담당하는 곳">
            <input className={inputCls} value={form.court_name} maxLength={200} required
              onChange={(e) => set("court_name", e.target.value)} />
          </Field>
          {isPetition ? (
            <Field label="사건당사자와의 관계" required>
              <input className={inputCls} value={form.relationship} maxLength={50} required
                placeholder="예: 배우자, 친구, 직장 동료"
                onChange={(e) => set("relationship", e.target.value)} />
            </Field>
          ) : null}
        </section>

        {!isPetition ? (
          <section className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">선택사항</h2>
            <Field label="초범인가요?" required>
              <YesNoToggle value={firstOffense} onChange={setFirstOffense} />
            </Field>
            {firstOffense === false ? (
              <Field label="동종 전과가 있으신가요?" required>
                <YesNoToggle value={priorSameType} onChange={setPriorSameType} />
              </Field>
            ) : null}
            <Field label="현재 사건 진행단계" required>
              <select className={inputCls} value={form.case_stage} required
                onChange={(e) => set("case_stage", e.target.value)}>
                <option value="">선택해 주세요</option>
                {info.case_stage_options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="상대방과 합의 여부" required>
              <select className={inputCls} value={form.settlement_status} required
                onChange={(e) => set("settlement_status", e.target.value)}>
                <option value="">선택해 주세요</option>
                {info.settlement_status_options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>
          </section>
        ) : null}

        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            {isPetition ? "탄원인 정보" : "작성자 정보"}
          </h2>
          <Field label="성명" required>
            <input className={inputCls} value={form.writer_name} maxLength={100} required
              onChange={(e) => set("writer_name", e.target.value)} />
          </Field>
          <Field label="생년월일" required>
            <input type="date" className={inputCls} value={form.writer_birth} required
              min="1900-01-01" max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => set("writer_birth", e.target.value)} />
          </Field>
          <Field label="주소" required={!isPetition} hint={isPetition ? "생략하셔도 됩니다." : "부담되시면 '동'까지만 적으셔도 됩니다."}>
            <input className={inputCls} value={form.writer_address} maxLength={300} required={!isPetition}
              onChange={(e) => set("writer_address", e.target.value)} />
          </Field>
          <Field label="연락처" required={!isPetition} hint={isPetition ? "생략하셔도 됩니다." : undefined}>
            <input className={inputCls} value={form.writer_phone} maxLength={30} required={!isPetition}
              onChange={(e) => set("writer_phone", e.target.value)} />
          </Field>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            AI 작성을 위한 질문
          </h2>
          {Object.entries(questionLabels).map(([key, questionLabel]) => (
            <Field key={key} label={questionLabel} required>
              <textarea
                className={`${inputCls} min-h-[100px] resize-y leading-relaxed`}
                value={answers[key] ?? ""}
                maxLength={2000}
                required
                onChange={(e) => setAnswers((a) => ({ ...a, [key]: e.target.value }))}
              />
            </Field>
          ))}
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] py-4 font-bold text-white shadow-lg transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> AI가 작성 중...
            </>
          ) : (
            `${label} 자동 작성하기`
          )}
        </button>
        <p className="text-center text-xs text-zinc-500">
          제출 즉시 AI가 작성한 내용으로 PDF가 발급되며, 이후 내용 수정은 지원되지 않습니다.
        </p>
      </form>
    </div>
  );
}
