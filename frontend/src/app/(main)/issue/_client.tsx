"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { absUrl, getOrderDocuments, issueDocument, tokenStorage } from "@/lib/api";
import type { DocumentResponse } from "@/types/order";
import { Award } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export default function IssuePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("order_id");
  const orderId = orderIdParam ? Number(orderIdParam) : NaN;

  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentResponse | null>(null);
  // 이미 발급된 문서가 있는지 확인하는 동안은 입력 폼을 잠깐이라도 보여주지
  // 않는다 — 한번 발급된 수료증은 이름/생년월일을 "수정"할 수 있는 것처럼
  // 보이면 안 되므로(실제로는 재제출해도 서버가 기존 문서를 그대로
  // 반환한다 — 법원 제출용 서류를 이름 바꿔가며 여러 명 명의로 계속
  // 발급받는 것을 막기 위함), 기존 문서 조회가 끝난 뒤에만 폼을 그린다.
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    if (!Number.isFinite(orderId)) {
      setError("잘못된 접근입니다. (order_id 누락)");
      setCheckingExisting(false);
      return;
    }
    if (!tokenStorage.getAccess()) {
      router.replace(`/login?next=/issue?order_id=${orderId}`);
      return;
    }
    let cancelled = false;
    getOrderDocuments(orderId)
      .then((docs) => {
        if (cancelled) return;
        const existing = docs.find((d) => d.document_type === "certificate");
        if (existing) setDocument(existing);
      })
      .catch(() => {
        /* 조회 실패 시 그냥 새로 발급 시도할 수 있게 폼을 보여준다 */
      })
      .finally(() => {
        if (!cancelled) setCheckingExisting(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const doc = await issueDocument(orderId, {
        recipient_name: name,
        recipient_birth: birth,
      });
      setDocument(doc);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "수료증 발급에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (document) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-8 text-center shadow-sm">
          <p className="font-sans text-2xl font-bold text-[var(--color-primary)]">
            수료증이 발급되었습니다
          </p>
          <p className="mt-3 text-sm text-zinc-600">
            발급번호 <span className="font-mono">{document.issue_number}</span>
          </p>

          <div className="mt-8 flex flex-col gap-2">
            {document.pdf_url ? (
              <a
                href={absUrl(document.pdf_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded bg-[var(--color-accent)] py-3 font-semibold text-white hover:bg-[var(--color-accent-hover)]"
              >
                PDF 다운로드
              </a>
            ) : null}
            <Link
              href="/mypage"
              className="rounded border border-[var(--color-border)] py-3 text-sm text-zinc-700 hover:border-[var(--color-primary)]"
            >
              마이페이지로 이동
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (checkingExisting) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-zinc-500">확인 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-8 px-4 py-16">
      <PageHeader
        title="수료증 발급"
        subtitle="Issue Document"
        icon={<Award className="h-3.5 w-3.5" />}
        description="수료증에 표기될 정보를 정확히 입력해 주세요."
        centered
      />
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-sm font-medium text-zinc-800">
              성명
            </label>
            <input
              id="name"
              type="text"
              required
              minLength={1}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="birth" className="block text-sm font-medium text-zinc-800">
              생년월일
            </label>
            <input
              id="birth"
              type="date"
              required
              value={birth}
              onChange={(e) => setBirth(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </div>

          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            발급 후에는 성명·생년월일을 수정할 수 없으니, 수강자의 정보를
            정확히 입력하시기 바랍니다.
          </p>

          {error ? (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-[var(--color-primary)] py-3 font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {submitting ? "발급 중..." : "발급하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
