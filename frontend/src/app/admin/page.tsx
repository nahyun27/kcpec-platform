"use client";

import { useEffect, useState } from "react";
import { getAdminStats } from "@/lib/api";
import type { AdminOrderRow, AdminStats } from "@/types/admin";
import { PAYMENT_METHOD_LABEL } from "@/types/order";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(() => setError("통계를 불러오지 못했습니다."));
  }, []);

  if (error) return <p className="py-20 text-center text-sm text-red-600">{error}</p>;
  if (!stats) return <p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">대시보드</h1>
        <p className="mt-1 text-sm text-zinc-500">
          누적 회원 {stats.total_users.toLocaleString()}명 · 누적 매출{" "}
          {stats.total_revenue.toLocaleString()}원
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="오늘 신규 가입"
          value={`${stats.today_signups.toLocaleString()}명`}
          accent="primary"
        />
        <StatCard
          label="오늘 결제 건수"
          value={`${stats.today_paid_orders.toLocaleString()}건`}
          accent="primary"
        />
        <StatCard
          label="오늘 매출"
          value={`${stats.today_revenue.toLocaleString()}원`}
          accent="accent"
        />
        <StatCard
          label="이번 달 매출"
          value={`${stats.month_revenue.toLocaleString()}원`}
          accent="accent"
        />
      </section>

      <section>
        <h2 className="mb-3 font-sans text-lg font-bold text-[var(--color-primary)]">
          최근 주문 5건
        </h2>
        {stats.recent_orders.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
            주문 내역이 없습니다.
          </p>
        ) : (
          <RecentOrdersTable rows={stats.recent_orders} />
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "primary" | "accent";
}) {
  const color = accent === "accent" ? "text-[var(--color-accent)]" : "text-[var(--color-primary)]";
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-2 font-sans text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function RecentOrdersTable({ rows }: { rows: AdminOrderRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-3">주문일시</th>
            <th className="px-4 py-3">고객명</th>
            <th className="px-4 py-3">강의명</th>
            <th className="px-4 py-3">패키지</th>
            <th className="px-4 py-3">결제수단</th>
            <th className="px-4 py-3 text-right">금액</th>
            <th className="px-4 py-3">상태</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {rows.map((r) => {
            const isPendingBank =
              r.status === "pending" && r.payment_method === "bank_transfer";
            return (
              <tr key={r.id} className={isPendingBank ? "bg-red-50/50" : ""}>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {new Date(r.created_at).toLocaleString("ko-KR")}
                </td>
                <td className="px-4 py-3 font-medium">{r.username}</td>
                <td className="px-4 py-3">{r.course_title}</td>
                <td className="px-4 py-3">{r.package_name}</td>
                <td className="px-4 py-3 text-xs">
                  {PAYMENT_METHOD_LABEL[r.payment_method]}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {r.amount.toLocaleString()}원
                </td>
                <td className="px-4 py-3">
                  {isPendingBank ? (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                      입금 대기
                    </span>
                  ) : r.status === "paid" ? (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      결제완료
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500">{r.status}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
