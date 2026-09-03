"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isAxiosError } from "axios";
import {
  absUrl,
  confirmBankOrder,
  getAdminOrderDocuments,
  getAdminOrders,
} from "@/lib/api";
import type { AdminOrderRow, AdminOrdersResponse } from "@/types/admin";
import { PAYMENT_METHOD_LABEL, type DocumentResponse, type OrderStatus } from "@/types/order";

type FilterValue = OrderStatus | "all";

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "paid", label: "결제완료" },
  { value: "pending", label: "입금대기" },
  { value: "cancelled", label: "취소" },
];

function isFilterValue(v: unknown): v is FilterValue {
  return v === "all" || v === "paid" || v === "pending" || v === "cancelled";
}

export default function AdminOrdersPageWrapper() {
  // useSearchParams 사용을 위해 Suspense 경계 필요
  return (
    <Suspense fallback={null}>
      <AdminOrdersPage />
    </Suspense>
  );
}

function AdminOrdersPage() {
  const search = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const statusParam = search.get("status");
  const filter: FilterValue = isFilterValue(statusParam) ? statusParam : "all";

  function setFilter(next: FilterValue) {
    const params = new URLSearchParams(search.toString());
    if (next === "all") params.delete("status");
    else params.set("status", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const [data, setData] = useState<AdminOrdersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [docsOrder, setDocsOrder] = useState<AdminOrderRow | null>(null);

  async function load() {
    setError(null);
    try {
      const d = await getAdminOrders({
        status: filter === "all" ? undefined : filter,
        page: 1,
        size: 100,
      });
      setData(d);
    } catch {
      setError("주문 목록을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function handleConfirm(row: AdminOrderRow) {
    setConfirmingId(row.id);
    try {
      await confirmBankOrder(row.id);
      await load();
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      alert(detail ?? "입금 확인에 실패했습니다.");
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">주문</h1>
        <p className="mt-1 text-sm text-zinc-500">
          전체 주문 내역 / 무통장 입금 확인 / 발급 문서 조회
        </p>
      </header>

      <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100/80 p-1.5 shadow-inner">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all ${
                active
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5"
                  : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="py-10 text-center text-sm text-red-600">{error}</p>
      ) : !data ? (
        <p className="py-10 text-center text-sm text-zinc-500">불러오는 중...</p>
      ) : data.items.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">주문이 없습니다.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-slate-200/60 bg-slate-50/50 text-[12px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">주문일시</th>
                <th className="px-4 py-3">고객명</th>
                <th className="px-4 py-3">이메일</th>
                <th className="px-4 py-3">강의명</th>
                <th className="px-4 py-3">결제수단</th>
                <th className="px-4 py-3 text-right">금액</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((r) => {
                const isPendingBank =
                  r.status === "pending" && r.payment_method === "bank_transfer";
                return (
                  <tr key={r.id} className={`transition-colors hover:bg-slate-50/80 ${isPendingBank ? "bg-red-50/40" : ""}`}>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(r.created_at).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{r.username}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {r.email ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.course_title}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {PAYMENT_METHOD_LABEL[r.payment_method]}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {r.amount.toLocaleString()}원
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} pendingBank={isPendingBank} />
                    </td>
                    <td className="px-4 py-3">
                      {isPendingBank ? (
                        <button
                          type="button"
                          onClick={() => handleConfirm(r)}
                          disabled={confirmingId === r.id}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                        >
                          {confirmingId === r.id ? "처리 중..." : "입금 확인"}
                        </button>
                      ) : r.status === "paid" ? (
                        <button
                          type="button"
                          onClick={() => setDocsOrder(r)}
                          className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                          발급 현황
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {docsOrder ? (
        <DocumentsModal order={docsOrder} onClose={() => setDocsOrder(null)} />
      ) : null}
    </div>
  );
}

function StatusBadge({
  status,
  pendingBank,
}: {
  status: OrderStatus;
  pendingBank: boolean;
}) {
  if (pendingBank) {
    return (
      <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
        입금 대기
      </span>
    );
  }
  const map: Record<OrderStatus, { label: string; cls: string }> = {
    paid: { label: "결제완료", cls: "bg-emerald-100 text-emerald-700" },
    pending: { label: "결제대기", cls: "bg-amber-100 text-amber-700" },
    cancelled: { label: "취소", cls: "bg-zinc-200 text-zinc-700" },
    refunded: { label: "환불", cls: "bg-zinc-200 text-zinc-700" },
  };
  const { label, cls } = map[status];
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

function DocumentsModal({
  order,
  onClose,
}: {
  order: AdminOrderRow;
  onClose: () => void;
}) {
  const [docs, setDocs] = useState<DocumentResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminOrderDocuments(order.id)
      .then(setDocs)
      .catch(() => setError("문서 목록을 불러오지 못했습니다."));
  }, [order.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="font-sans text-lg font-bold text-[var(--color-primary)]">
            발급 문서
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-900"
          >
            닫기
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          주문 #{order.id} · {order.username} · {order.course_title}
        </p>

        <div className="mt-4">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : docs == null ? (
            <p className="text-sm text-zinc-500">불러오는 중...</p>
          ) : docs.length === 0 ? (
            <p className="text-sm text-zinc-500">발급된 문서가 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-200 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{d.issue_number}</p>
                    <p className="text-xs text-zinc-500">
                      {d.document_type} · {d.status}
                    </p>
                  </div>
                  {d.pdf_url ? (
                    <a
                      href={absUrl(d.pdf_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)]"
                    >
                      PDF
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
