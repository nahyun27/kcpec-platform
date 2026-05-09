"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  ExternalLink,
  GraduationCap,
  ReceiptText,
  Repeat,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import { getAdminSalesStats, getAdminVisitorStats } from "@/lib/api";
import { PAYMENT_METHOD_LABEL } from "@/types/order";
import type { SalesStats, VisitorStats } from "@/types/admin";

const PIE_COLORS = ["#1C3461", "#2A4B8D", "#5B85C7", "#A6BFD9", "#D9A23E"];

type TabKey = "sales" | "visitors";

function isTabKey(v: unknown): v is TabKey {
  return v === "sales" || v === "visitors";
}

export default function AdminStatsPageWrapper() {
  // useSearchParams 사용을 위해 Suspense 경계 필요 (Next.js 요구사항)
  return (
    <Suspense fallback={null}>
      <AdminStatsPage />
    </Suspense>
  );
}

function AdminStatsPage() {
  const search = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const tabParam = search.get("tab");
  const tab: TabKey = isTabKey(tabParam) ? tabParam : "sales";

  function setTab(next: TabKey) {
    const params = new URLSearchParams(search.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const [data, setData] = useState<SalesStats | null>(null);
  const [visitors, setVisitors] = useState<VisitorStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Recharts ResponsiveContainer 가 첫 렌더에서 부모 width 를 0/-1 로 읽는 케이스 회피
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    getAdminSalesStats()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError("매출 통계를 불러오지 못했습니다.");
      });
    getAdminVisitorStats()
      .then((v) => {
        if (!cancelled) setVisitors(v);
      })
      .catch(() => {
        /* 방문자 섹션은 부가 정보 — 실패는 silent */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="py-20 text-center text-sm text-red-600">{error}</p>;
  if (!data) return <p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>;

  const totalByCourseRevenue = data.by_course.reduce((acc, r) => acc + r.revenue, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">통계</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {tab === "sales"
            ? "paid 상태 주문 기준. 최근 30일 일별 분포 + 상품/결제수단 별 집계."
            : "신규 가입 / 수강 신청 / 전환율 요약. 실시간 방문자는 Google Analytics 에서 확인."}
        </p>
      </header>

      <StatsTabs tab={tab} onChange={setTab} />

      {tab === "sales" ? (
        <SalesStatsView
          data={data}
          totalByCourseRevenue={totalByCourseRevenue}
          mounted={mounted}
        />
      ) : (
        <VisitorStatsView visitors={visitors} />
      )}
    </div>
  );
}

function StatsTabs({
  tab,
  onChange,
}: {
  tab: TabKey;
  onChange: (next: TabKey) => void;
}) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: "sales", label: "매출 통계" },
    { key: "visitors", label: "방문자 통계" },
  ];
  return (
    <div className="flex border-b border-zinc-200">
      {tabs.map((t) => {
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors ${
              active
                ? "border-[#1C3461] font-semibold text-[#1C3461]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function SalesStatsView({
  data,
  totalByCourseRevenue,
  mounted,
}: {
  data: SalesStats;
  totalByCourseRevenue: number;
  mounted: boolean;
}) {
  const momChange = (() => {
    const last = data.last_month_revenue;
    const cur = data.this_month_revenue;
    if (last === 0 && cur === 0) return { pct: 0, dir: "flat" as const };
    if (last === 0) return { pct: 100, dir: "up" as const };
    const diff = ((cur - last) / last) * 100;
    return {
      pct: Math.abs(diff),
      dir: diff > 0 ? ("up" as const) : diff < 0 ? ("down" as const) : ("flat" as const),
    };
  })();

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<Wallet className="h-4 w-4" />}
          label="이번달 매출"
          value={`${data.this_month_revenue.toLocaleString()}원`}
        />
        <SummaryCard
          icon={<ReceiptText className="h-4 w-4" />}
          label="이번달 주문"
          value={`${data.this_month_orders.toLocaleString()}건`}
        />
        <SummaryCard
          icon={
            momChange?.dir === "up" ? (
              <ArrowUpRight className="h-4 w-4 text-emerald-600" />
            ) : momChange?.dir === "down" ? (
              <ArrowDownRight className="h-4 w-4 text-red-600" />
            ) : (
              <TrendingUp className="h-4 w-4" />
            )
          }
          label="전월 대비"
          value={
            momChange == null
              ? "—"
              : momChange.dir === "flat"
                ? "변동 없음"
                : `${momChange.dir === "up" ? "↑" : "↓"} ${momChange.pct.toFixed(1)}%`
          }
          sub={`전월 ${data.last_month_revenue.toLocaleString()}원`}
          tone={
            momChange?.dir === "up"
              ? "good"
              : momChange?.dir === "down"
                ? "bad"
                : "neutral"
          }
        />
        <SummaryCard
          icon={<CreditCard className="h-4 w-4" />}
          label="평균 주문금액"
          value={`${data.avg_order_amount.toLocaleString()}원`}
        />
      </div>

      {/* 일별 매출 차트 */}
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 font-sans text-base font-bold text-[var(--color-primary)]">
          최근 30일 일별 매출
        </h2>
        <div className="h-72 w-full min-w-0" style={{ width: "100%", minWidth: 0 }}>
          {mounted ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart
              data={data.daily_revenue}
              margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
            >
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#71717a" }}
                tickFormatter={(d: string) => d.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#71717a" }}
                tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}만`}
                width={48}
              />
              <Tooltip
                formatter={(v) => `${Number(v).toLocaleString()}원`}
                labelFormatter={(d) => String(d)}
                contentStyle={{ fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#1C3461"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 상품별 판매 현황 */}
        <section className="lg:col-span-2 rounded-lg border border-zinc-200 bg-white">
          <header className="border-b border-zinc-200 px-4 py-3">
            <h2 className="font-sans text-base font-bold text-[var(--color-primary)]">
              상품별 판매 현황
            </h2>
            <p className="text-xs text-zinc-500">paid 누적 기준 · 매출 내림차순</p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2.5">강의</th>
                  <th className="px-3 py-2.5">패키지</th>
                  <th className="px-3 py-2.5 text-right">건수</th>
                  <th className="px-3 py-2.5 text-right">매출액</th>
                  <th className="w-32 px-3 py-2.5 text-right">비율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.by_course.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-12 text-center text-zinc-500">
                      판매 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  data.by_course.map((row) => {
                    const pct =
                      totalByCourseRevenue > 0
                        ? (row.revenue / totalByCourseRevenue) * 100
                        : 0;
                    return (
                      <tr key={`${row.course_title}|${row.package_name}`}>
                        <td className="px-3 py-2.5 font-medium text-slate-900">
                          {row.course_title}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-zinc-600">
                          {row.package_name}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {row.count.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[var(--color-primary)]">
                          {row.revenue.toLocaleString()}원
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
                              <div
                                className="h-full bg-[var(--color-accent)]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-10 text-right text-xs text-zinc-500">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 결제수단별 분포 */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="mb-2 font-sans text-base font-bold text-[var(--color-primary)]">
            결제수단별 분포
          </h2>
          {data.by_payment.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">데이터 없음</p>
          ) : (
            <>
              <div className="h-56 w-full min-w-0" style={{ width: "100%", minWidth: 0 }}>
                {mounted ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Tooltip
                      formatter={(v, _n, item) => {
                        const method = (item?.payload as { method?: string } | undefined)?.method;
                        const label = method
                          ? PAYMENT_METHOD_LABEL[method as keyof typeof PAYMENT_METHOD_LABEL] ??
                            method
                          : "";
                        return [`${Number(v).toLocaleString()}건`, label];
                      }}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={24}
                      formatter={(value: string) =>
                        PAYMENT_METHOD_LABEL[value as keyof typeof PAYMENT_METHOD_LABEL] ??
                        value
                      }
                      wrapperStyle={{ fontSize: 11 }}
                    />
                    <Pie
                      data={data.by_payment.map((r) => ({ ...r }))}
                      dataKey="count"
                      nameKey="method"
                      cx="50%"
                      cy="42%"
                      innerRadius={32}
                      outerRadius={64}
                    >
                      {data.by_payment.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                ) : null}
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {data.by_payment.map((r, i) => (
                  <li
                    key={r.method}
                    className="flex items-center justify-between border-t border-zinc-100 py-1"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      {PAYMENT_METHOD_LABEL[r.method] ?? r.method}
                    </span>
                    <span className="tabular-nums text-zinc-600">
                      {r.count.toLocaleString()}건 · {r.revenue.toLocaleString()}원
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

    </div>
  );
}

function VisitorStatsView({ visitors }: { visitors: VisitorStats | null }) {
  if (visitors == null) {
    return (
      <p className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
        방문자 지표를 불러오는 중...
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<UserPlus className="h-4 w-4" />}
          label="이번 달 신규 회원"
          value={`${visitors.new_users_this_month.toLocaleString()}명`}
          sub={`전월 ${visitors.new_users_last_month.toLocaleString()}명`}
        />
        <SummaryCard
          icon={<Users className="h-4 w-4" />}
          label="누적 수강 신청"
          value={`${visitors.total_enrollments.toLocaleString()}건`}
        />
        <SummaryCard
          icon={<Repeat className="h-4 w-4" />}
          label="이번 달 전환율"
          value={`${visitors.conversion_rate.toFixed(1)}%`}
          sub="결제 완료 / 신규 가입"
        />
        <SummaryCard
          icon={<GraduationCap className="h-4 w-4" />}
          label="평균 수강 강의 수"
          value={`${visitors.avg_courses_per_user.toFixed(1)}건`}
          sub="활성 사용자 1인당"
        />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        실시간 방문자 통계는 Google Analytics 대시보드에서 확인하세요.{" "}
        <a
          href="https://analytics.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary)] hover:underline"
        >
          analytics.google.com
          <ExternalLink className="h-3 w-3" />
        </a>
        <p className="mt-1 text-xs text-zinc-500">
          향후 GA4 Data API 연동 시 일별 방문자/이벤트 차트가 이 영역에 추가됩니다.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const toneCls =
    tone === "good"
      ? "text-emerald-600"
      : tone === "bad"
        ? "text-red-600"
        : "text-[var(--color-primary)]";
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
        {icon}
        {label}
      </div>
      <p className={`mt-2 font-sans text-2xl font-bold ${toneCls}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  );
}
