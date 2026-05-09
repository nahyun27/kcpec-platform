"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CheckCircle2, CreditCard, HelpCircle } from "lucide-react";

import { getAdminSalesStats, getAdminStats } from "@/lib/api";
import type {
  AdminActivity,
  AdminOrderRow,
  AdminStats,
  AdminTopCourse,
  AdminUserBrief,
  SalesStats,
} from "@/types/admin";
import { PAYMENT_METHOD_LABEL } from "@/types/order";

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-pink-500",
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [sales, setSales] = useState<SalesStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminStats()
      .then((s) => !cancelled && setStats(s))
      .catch(() => !cancelled && setError("통계를 불러오지 못했습니다."));
    getAdminSalesStats()
      .then((s) => !cancelled && setSales(s))
      .catch(() => {
        /* 주간 차트는 부가 정보 — 실패 silent */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="py-20 text-center text-sm text-red-600">{error}</p>;
  if (!stats) return <p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>;

  const last7 = sales?.daily_revenue.slice(-7) ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">대시보드</h1>
        <p className="mt-1 text-sm text-zinc-500">
          누적 회원 {stats.total_users.toLocaleString()}명 · 누적 매출{" "}
          {stats.total_revenue.toLocaleString()}원
        </p>
      </header>

      {/* 1) 상단 카드 4개 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="오늘 신규 가입"
          value={`${stats.today_signups.toLocaleString()}명`}
          delta={diffLabel(stats.today_signups, stats.yesterday_new_users, "어제")}
        />
        <StatCard
          label="오늘 결제 건수"
          value={`${stats.today_paid_orders.toLocaleString()}건`}
          delta={diffLabel(stats.today_paid_orders, stats.yesterday_orders, "어제")}
        />
        <StatCard
          label="오늘 매출"
          value={`${stats.today_revenue.toLocaleString()}원`}
          delta={diffLabel(stats.today_revenue, stats.yesterday_revenue, "어제", true)}
          accent="accent"
        />
        <StatCard
          label="이번 달 매출"
          value={`${stats.month_revenue.toLocaleString()}원`}
          accent="accent"
        />
      </section>

      {/* 2 + 3) 주간 매출 추이 + 인기 강의 */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="주간 매출 추이">
          {last7.length === 0 ? (
            <p className="py-10 text-center text-xs text-zinc-400">데이터 없음</p>
          ) : (
            <WeeklyMiniChart data={last7} />
          )}
        </Card>
        <Card title="인기 강의 top 5">
          <TopCoursesList items={stats.top_courses} />
        </Card>
      </section>

      {/* 4 + 5) 최근 가입 회원 + 최근 활동 로그 */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="최근 가입 회원">
          <RecentUsersList items={stats.recent_users} />
        </Card>
        <Card title="최근 활동 로그">
          <RecentActivitiesList items={stats.recent_activities} />
        </Card>
      </section>

      {/* 6) 최근 주문 5건 */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-gray-700">최근 주문 5건</h2>
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

// ---------- helpers --------------------------------------------------------

function diffLabel(
  today: number,
  yesterday: number,
  label: string,
  isCurrency = false,
): string {
  const diff = today - yesterday;
  const fmt = (n: number) =>
    isCurrency ? `${n.toLocaleString()}원` : n.toLocaleString();
  if (diff === 0) return `${label} 대비 동일`;
  const sign = diff > 0 ? "▲" : "▼";
  return `${label} 대비 ${sign} ${fmt(Math.abs(diff))}`;
}

function timeAgo(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "어제";
  if (day < 30) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

function avatarColorFor(name: string): string {
  const ch = name.charCodeAt(0) || 0;
  return AVATAR_COLORS[ch % AVATAR_COLORS.length];
}

// ---------- subcomponents --------------------------------------------------

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-gray-700">{title}</h2>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  accent = "primary",
}: {
  label: string;
  value: string;
  delta?: string;
  accent?: "primary" | "accent";
}) {
  const color =
    accent === "accent" ? "text-[var(--color-accent)]" : "text-[var(--color-primary)]";
  const deltaTone = delta?.startsWith("어제 대비 ▲")
    ? "text-emerald-600"
    : delta?.startsWith("어제 대비 ▼")
      ? "text-red-600"
      : "text-zinc-500";
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-2 font-sans text-2xl font-bold ${color}`}>{value}</p>
      {delta ? <p className={`mt-1 text-[11px] ${deltaTone}`}>{delta}</p> : null}
    </div>
  );
}

function WeeklyMiniChart({
  data,
}: {
  data: { date: string; revenue: number }[];
}) {
  const todayKey = new Date().toISOString().slice(0, 10);
  return (
    <div className="h-20 w-full min-w-0" style={{ width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <Tooltip
            formatter={(v) => `${Number(v).toLocaleString()}원`}
            labelFormatter={(d) => String(d).slice(5)}
            contentStyle={{ fontSize: 11 }}
            cursor={{ fill: "transparent" }}
          />
          <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.date === todayKey ? "#A6BFD9" : "#1C3461"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TopCoursesList({ items }: { items: AdminTopCourse[] }) {
  if (items.length === 0)
    return <p className="py-10 text-center text-xs text-zinc-400">아직 판매 내역이 없습니다.</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((c) => (
        <li key={c.course_title} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-medium text-slate-800">{c.course_title}</span>
            <span className="shrink-0 tabular-nums text-zinc-500">
              {c.revenue.toLocaleString()}원 · {c.percentage.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full bg-[var(--color-accent)]"
              style={{ width: `${Math.min(100, c.percentage)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function RecentUsersList({ items }: { items: AdminUserBrief[] }) {
  if (items.length === 0)
    return <p className="py-10 text-center text-xs text-zinc-400">최근 가입 회원이 없습니다.</p>;
  return (
    <ul className="space-y-3">
      {items.map((u) => (
        <li key={u.id} className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColorFor(u.name)}`}
          >
            {u.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{u.name}</p>
            <p className="truncate text-xs text-zinc-500">{u.email}</p>
          </div>
          <span className="shrink-0 text-[11px] text-zinc-400">{timeAgo(u.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

function RecentActivitiesList({ items }: { items: AdminActivity[] }) {
  if (items.length === 0)
    return <p className="py-10 text-center text-xs text-zinc-400">최근 활동이 없습니다.</p>;
  const dotClass: Record<AdminActivity["type"], string> = {
    order_paid: "bg-emerald-500",
    course_completed: "bg-blue-500",
    qna_posted: "bg-amber-500",
  };
  const Icon: Record<AdminActivity["type"], React.ReactNode> = {
    order_paid: <CreditCard className="h-3 w-3 text-emerald-600" />,
    course_completed: <CheckCircle2 className="h-3 w-3 text-blue-600" />,
    qna_posted: <HelpCircle className="h-3 w-3 text-amber-600" />,
  };
  return (
    <ul className="space-y-3">
      {items.map((a, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span
            className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${dotClass[a.type]}`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug text-slate-800">
              <span className="mr-1 inline-block align-middle">{Icon[a.type]}</span>
              {a.message}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400">{timeAgo(a.created_at)}</p>
          </div>
        </li>
      ))}
    </ul>
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
                <td className="px-4 py-3 text-xs">{PAYMENT_METHOD_LABEL[r.payment_method]}</td>
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

