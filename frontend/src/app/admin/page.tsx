"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import {
  Users,
  CreditCard,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  CheckCircle2,
  MessageCircle,
  UserX,
} from "lucide-react";

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
  "bg-gradient-to-br from-blue-500 to-blue-600",
  "bg-gradient-to-br from-emerald-400 to-emerald-600",
  "bg-gradient-to-br from-amber-400 to-orange-500",
  "bg-gradient-to-br from-violet-500 to-purple-600",
  "bg-gradient-to-br from-pink-500 to-rose-600",
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [sales, setSales] = useState<SalesStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Recharts ResponsiveContainer 가 첫 렌더에서 부모 width 를 0/-1 로 읽는 케이스를
  // 회피하기 위해 마운트 후에만 차트를 렌더한다.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
      <header className="mb-8">
        <h1 className="font-sans text-3xl font-bold tracking-tight text-slate-900">대시보드</h1>
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
          delta={yesterdayLabel(stats.yesterday_new_users, "명")}
          icon={<Users className="h-5 w-5 text-blue-500" />}
        />
        <StatCard
          label="오늘 결제 건수"
          value={`${stats.today_paid_orders.toLocaleString()}건`}
          delta={yesterdayLabel(stats.yesterday_orders, "건")}
          icon={<CreditCard className="h-5 w-5 text-emerald-500" />}
        />
        <StatCard
          label="오늘 매출"
          value={`${stats.today_revenue.toLocaleString()}원`}
          delta={yesterdayLabel(stats.yesterday_revenue, "원")}
          accent="accent"
          icon={<TrendingUp className="h-5 w-5 text-[var(--color-accent)]" />}
        />
        <StatCard
          label="이번 달 매출"
          value={`${stats.month_revenue.toLocaleString()}원`}
          accent="accent"
          icon={<Wallet className="h-5 w-5 text-blue-600" />}
        />
      </section>

      {/* 2 + 3) 주간 매출 추이 + 인기 강의 */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="주간 매출 추이">
          {last7.length === 0 ? (
            <p className="py-10 text-center text-xs text-zinc-400">데이터 없음</p>
          ) : (
            <WeeklyMiniChart data={last7} mounted={mounted} />
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
        <h2 className="mb-4 text-sm font-bold tracking-wide text-slate-800">최근 주문 5건</h2>
        {stats.recent_orders.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-xl border border-slate-200 border-dashed bg-slate-50/50">
            <p className="text-sm text-slate-500">주문 내역이 없습니다.</p>
          </div>
        ) : (
          <RecentOrdersTable rows={stats.recent_orders} />
        )}
      </section>
    </div>
  );
}

// ---------- helpers --------------------------------------------------------

// "어제 N명 / N건 / N원" 형식 — 어제가 0이면 null 반환 (StatCard 가 숨김 처리)
function yesterdayLabel(
  yesterday: number,
  unit: "명" | "건" | "원",
): string | undefined {
  if (yesterday <= 0) return undefined;
  return `어제 ${yesterday.toLocaleString()}${unit}`;
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
    <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-bold tracking-wide text-slate-800">{title}</h2>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  accent = "primary",
  icon,
}: {
  label: string;
  value: string;
  delta?: string;
  accent?: "primary" | "accent";
  icon?: React.ReactNode;
}) {
  const color =
    accent === "accent" ? "text-blue-600" : "text-slate-900";
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        {icon && <div className="rounded-full bg-slate-50 p-2 ring-1 ring-slate-100">{icon}</div>}
      </div>
      <p className={`mt-4 font-sans text-3xl font-bold tracking-tight ${color}`}>{value}</p>
      {delta ? (
        <div className="mt-4 flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] text-emerald-600">
            <ArrowUpRight className="h-3 w-3" />
          </span>
          <span className="text-[12px] font-medium text-slate-500">{delta}</span>
        </div>
      ) : null}
    </div>
  );
}

function WeeklyMiniChart({
  data,
  mounted,
}: {
  data: { date: string; revenue: number }[];
  mounted: boolean;
}) {
  const todayKey = new Date().toISOString().slice(0, 10);
  // 큰 값일 때만 만 단위 라벨 (시각적으로 너무 빽빽해지지 않도록)
  const maxRev = Math.max(...data.map((d) => d.revenue), 0);
  const showLabels = maxRev >= 100_000;
  const formatLabel = (v: unknown) => {
    const n = typeof v === "number" ? v : Number(v ?? 0);
    return n <= 0 ? "" : n >= 10_000 ? `${(n / 10_000).toFixed(0)}만` : `${n}`;
  };

  return (
    <div className="h-[220px] w-full min-w-0" style={{ width: "100%", minWidth: 0 }}>
      {mounted ? (
        <ResponsiveContainer width="100%" height={220} minWidth={0}>
          <BarChart data={data} margin={{ top: 30, right: 8, bottom: 0, left: 8 }}>
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => d.slice(5)}
              tick={{ fontSize: 10, fill: "#71717a" }}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <Tooltip
              formatter={(v) => `${Number(v).toLocaleString()}원`}
              labelFormatter={(d, payload) => {
                const dateStr = String(d).slice(5);
                const isToday = String(d) === todayKey;
                return isToday ? `${dateStr} (집계 중)` : dateStr;
                // payload 미사용 — eslint 회피용 args 만 받음
                void payload;
              }}
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
              {showLabels ? (
                <LabelList
                  dataKey="revenue"
                  position="top"
                  formatter={formatLabel}
                  style={{ fontSize: 9, fill: "#52525b" }}
                />
              ) : null}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

function TopCoursesList({ items }: { items: AdminTopCourse[] }) {
  if (items.length === 0)
    return <p className="py-10 text-center text-xs text-zinc-400">아직 판매 내역이 없습니다.</p>;
  return (
    <ul className="space-y-4">
      {items.map((c, idx) => (
        <li key={c.course_title} className="flex items-center gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 text-[13px] font-bold text-slate-400 ring-1 ring-slate-200/60">
            {idx + 1}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-semibold text-slate-800">{c.course_title}</span>
              <span className="shrink-0 tabular-nums font-medium text-slate-500">
                {c.revenue.toLocaleString()}원 · {c.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${Math.min(100, c.percentage)}%` }}
              />
            </div>
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
        <li key={u.id} className="flex items-center gap-3.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm ${avatarColorFor(u.name)}`}
          >
            {u.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-slate-900">{u.name}</p>
            <p className="truncate text-[12px] text-slate-500">{u.email}</p>
          </div>
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">{timeAgo(u.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

function RecentActivitiesList({ items }: { items: AdminActivity[] }) {
  if (items.length === 0)
    return <p className="py-10 text-center text-xs text-zinc-400">최근 활동이 없습니다.</p>;

  return (
    <ul className="space-y-0">
      {items.map((a, i) => {
        let Icon = MessageCircle;
        let colorClass = "bg-slate-100 text-slate-500 ring-slate-200";
        if (a.type === "order_paid") {
          Icon = CreditCard;
          colorClass = "bg-emerald-50 text-emerald-600 ring-emerald-100";
        } else if (a.type === "course_completed") {
          Icon = CheckCircle2;
          colorClass = "bg-blue-50 text-blue-600 ring-blue-100";
        } else if (a.type === "qna_posted") {
          Icon = MessageCircle;
          colorClass = "bg-amber-50 text-amber-600 ring-amber-100";
        } else if (a.type === "user_deleted") {
          Icon = UserX;
          colorClass = "bg-red-50 text-red-600 ring-red-100";
        }

        return (
          <li key={i} className="relative flex items-start gap-3 pb-4 last:pb-0">
            {i !== items.length - 1 && (
              <span className="absolute left-[13px] top-7 -ml-px h-full w-0.5 bg-slate-100" aria-hidden="true" />
            )}
            <span
              className={`relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ${colorClass}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-[13px] leading-snug text-slate-700">{a.message}</p>
              <p className="mt-1 text-[11px] font-medium text-slate-400">{timeAgo(a.created_at)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RecentOrdersTable({ rows }: { rows: AdminOrderRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-slate-200/60 bg-slate-50/50 text-[12px] font-bold uppercase tracking-wider text-slate-500">
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
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const isPendingBank =
              r.status === "pending" && r.payment_method === "bank_transfer";
            return (
              <tr key={r.id} className={isPendingBank ? "bg-red-50/50" : "transition-colors hover:bg-slate-50/80"}>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(r.created_at).toLocaleString("ko-KR")}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-900">{r.username}</td>
                <td className="px-4 py-3 text-slate-700">{r.course_title}</td>
                <td className="px-4 py-3 text-slate-700">{r.package_name}</td>
                <td className="px-4 py-3 text-slate-500">{PAYMENT_METHOD_LABEL[r.payment_method]}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-900">
                  {r.amount.toLocaleString()}원
                </td>
                <td className="px-4 py-3">
                  {isPendingBank ? (
                    <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/10">
                      입금 대기
                    </span>
                  ) : r.status === "paid" ? (
                    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                      결제완료
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-500/10">
                      {r.status}
                    </span>
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

