"use client";

import { useEffect, useState } from "react";
import { getAdminStats } from "@/lib/api";
import type { AdminOrderRow, AdminStats } from "@/types/admin";
import { PAYMENT_METHOD_LABEL } from "@/types/order";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminStats().then(setStats).catch(() => setError("통계를 불러오지 못했습니다."));
  }, []);

  if (error) return <p className="py-20 text-center text-sm text-red-600">{error}</p>;
  if (!stats) return <p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">대시보드</h1>
        <p className="mt-1 text-sm text-zinc-500">
          오늘 가입 {stats.today_signups}명 · 오늘 결제 {stats.today_paid_orders}건
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="총 회원수" value={`${stats.total_users.toLocaleString()}명`} />
        <StatCard
          label="총 수강 등록"
          value={`${stats.total_enrollments.toLocaleString()}건`}
        />
        <StatCard
          label="총 결제 (paid)"
          value={`${stats.total_orders_paid.toLocaleString()}건`}
        />
        <StatCard
          label="총 매출"
          value={`${stats.total_revenue.toLocaleString()}원`}
        />
      </section>

      <section>
        <h2 className="mb-3 font-sans text-lg font-bold text-[var(--color-primary)]">
          최근 주문 5건
        </h2>
        {stats.recent_orders.length === 0 ? (
          <EmptyTable text="주문 내역이 없습니다." />
        ) : (
          <RecentOrdersTable rows={stats.recent_orders} />
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 font-sans text-2xl font-bold text-[var(--color-primary)]">{value}</p>
    </div>
  );
}

function RecentOrdersTable({ rows }: { rows: AdminOrderRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-3">주문</th>
            <th className="px-4 py-3">사용자</th>
            <th className="px-4 py-3">강의</th>
            <th className="px-4 py-3">패키지</th>
            <th className="px-4 py-3 text-right">금액</th>
            <th className="px-4 py-3">상태</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 text-xs text-zinc-500">#{r.id}</td>
              <td className="px-4 py-3">{r.username}</td>
              <td className="px-4 py-3">{r.course_title}</td>
              <td className="px-4 py-3">
                {r.package_name} · {PAYMENT_METHOD_LABEL[r.payment_method]}
              </td>
              <td className="px-4 py-3 text-right">{r.amount.toLocaleString()}원</td>
              <td className="px-4 py-3">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyTable({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}
