"use client";

import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { confirmBankOrder, getAdminOrders } from "@/lib/api";
import type { AdminOrderRow, AdminOrdersResponse } from "@/types/admin";
import { PAYMENT_METHOD_LABEL, type OrderStatus } from "@/types/order";

const FILTERS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "paid", label: "결제 완료" },
  { value: "pending", label: "결제 대기" },
  { value: "cancelled", label: "취소" },
];

export default function AdminOrdersPage() {
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [data, setData] = useState<AdminOrdersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  async function load() {
    setError(null);
    try {
      const d = await getAdminOrders({
        status: filter === "all" ? undefined : filter,
        page: 1,
        size: 50,
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
          전체 주문 내역 / 무통장 입금 확인 처리
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              filter === f.value
                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-[var(--color-primary)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="py-10 text-center text-sm text-red-600">{error}</p>
      ) : !data ? (
        <p className="py-10 text-center text-sm text-zinc-500">불러오는 중...</p>
      ) : data.items.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">주문이 없습니다.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">주문</th>
                <th className="px-4 py-3">사용자</th>
                <th className="px-4 py-3">강의</th>
                <th className="px-4 py-3">패키지</th>
                <th className="px-4 py-3">결제수단</th>
                <th className="px-4 py-3 text-right">금액</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-xs text-zinc-500">#{r.id}</td>
                  <td className="px-4 py-3">{r.username}</td>
                  <td className="px-4 py-3">{r.course_title}</td>
                  <td className="px-4 py-3">{r.package_name}</td>
                  <td className="px-4 py-3 text-xs">
                    {PAYMENT_METHOD_LABEL[r.payment_method]}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.amount.toLocaleString()}원
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "pending" && r.payment_method === "bank_transfer" ? (
                      <button
                        type="button"
                        onClick={() => handleConfirm(r)}
                        disabled={confirmingId === r.id}
                        className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
                      >
                        {confirmingId === r.id ? "처리 중..." : "입금 확인"}
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; cls: string }> = {
    paid: { label: "결제 완료", cls: "bg-emerald-100 text-emerald-700" },
    pending: { label: "결제 대기", cls: "bg-amber-100 text-amber-700" },
    cancelled: { label: "취소", cls: "bg-zinc-200 text-zinc-700" },
    refunded: { label: "환불", cls: "bg-zinc-200 text-zinc-700" },
  };
  const { label, cls } = map[status];
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
