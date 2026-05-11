"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { absUrl, issueDocument, tokenStorage } from "@/lib/api";
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

  useEffect(() => {
    if (!Number.isFinite(orderId)) {
      setError("잘못된 접근입니다. (order_id 누락)");
      return;
    }
    if (!tokenStorage.getAccess()) {
      router.replace(`/login?next=/issue?order_id=${orderId}`);
    }
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
