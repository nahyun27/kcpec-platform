"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceArea,
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
  HeartHandshake,
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
import { getTierLabel } from "@/lib/courseTiers";

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
  const [days, setDays] = useState(30);
  const [visitorDays, setVisitorDays] = useState(30);
  // 상품별 판매현황 / 결제수단별 분포 전용 기간 — 일별 매출 그래프(days)와는
  // 별개로, "전체"(기본값, 기존과 동일) 또는 "최근 30일" 중 고를 수 있다.
  const [courseScope, setCourseScope] = useState<"all" | "recent">("all");
  // Recharts ResponsiveContainer 가 첫 렌더에서 부모 width 를 0/-1 로 읽는 케이스 회피
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    getAdminSalesStats(days, courseScope === "recent" ? 30 : undefined)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError("매출 통계를 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [days, courseScope]);

  useEffect(() => {
    let cancelled = false;
    getAdminVisitorStats(visitorDays)
      .then((v) => {
        if (!cancelled) setVisitors(v);
      })
      .catch(() => {
        /* 방문자 섹션은 부가 정보 — 실패는 silent */
      });
    return () => {
      cancelled = true;
    };
  }, [visitorDays]);

  if (error) return <p className="py-20 text-center text-sm text-red-600">{error}</p>;
  if (!data) return <p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>;

  const totalByCourseRevenue = data.by_course.reduce((acc, r) => acc + r.revenue, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">통계</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {tab === "sales"
            ? "paid 상태 주문 기준. 일별 분포 + 상품/결제수단 별 집계."
            : "신규 가입 / 수강 신청 / 전환율 요약. 실시간 방문자는 Google Analytics 에서 확인."}
        </p>
      </header>

      <StatsTabs tab={tab} onChange={setTab} />

      {tab === "sales" ? (
        <SalesStatsView
          data={data}
          totalByCourseRevenue={totalByCourseRevenue}
          mounted={mounted}
          days={days}
          onDaysChange={setDays}
          courseScope={courseScope}
          onCourseScopeChange={setCourseScope}
        />
      ) : (
        <VisitorStatsView
          visitors={visitors}
          mounted={mounted}
          days={visitorDays}
          onDaysChange={setVisitorDays}
        />
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
    <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100/80 p-1.5 shadow-inner">
      {tabs.map((t) => {
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all ${
              active
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5"
                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

const DAY_PRESETS = [7, 30, 90] as const;

// 카테고리 axis(dataKey="date")에 토/일 배경 음영을 넣는 ReferenceArea 목록 —
// 매출/방문자 그래프 둘 다 동일하게 써서 중복 안 되게 공용 함수로 뺐다.
function weekendReferenceAreas(dates: string[]) {
  return dates
    .filter((d) => {
      const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
      return dow === 0 || dow === 6;
    })
    .map((d) => (
      <ReferenceArea
        key={d}
        x1={d}
        x2={d}
        fill="#f97316"
        fillOpacity={0.08}
        ifOverflow="visible"
      />
    ));
}

function DayRangePicker({
  days,
  onChange,
}: {
  days: number;
  onChange: (days: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100/80 p-1">
      {DAY_PRESETS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
            days === d
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {d}일
        </button>
      ))}
    </div>
  );
}

function SalesStatsView({
  data,
  totalByCourseRevenue,
  mounted,
  days,
  onDaysChange,
  courseScope,
  onCourseScopeChange,
}: {
  data: SalesStats;
  totalByCourseRevenue: number;
  mounted: boolean;
  days: number;
  onDaysChange: (days: number) => void;
  courseScope: "all" | "recent";
  onCourseScopeChange: (scope: "all" | "recent") => void;
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

  // 상품별 매출을 사건 카테고리가 아니라 강의 전체보기 탭 기준(기본/행동
  // 교정/특수/단체 + 심리상담)으로 묶은 도넛 차트용 집계 — 25개 강의를
  // 낱개로 보여주는 것보다 이 4~5개 묶음이 한눈에 들어와서 더 보기 편하다는
  // 의견으로 추가(2026-09).
  const byTier = (() => {
    const totals = new Map<string, { revenue: number; count: number }>();
    for (const row of data.by_course) {
      const label = row.category === "심리상담" ? "심리상담" : getTierLabel(row.course_title);
      const bucket = totals.get(label) ?? { revenue: 0, count: 0 };
      bucket.revenue += row.revenue;
      bucket.count += row.count;
      totals.set(label, bucket);
    }
    return Array.from(totals, ([tier, v]) => ({ tier, ...v })).sort(
      (a, b) => b.revenue - a.revenue,
    );
  })();

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        <SummaryCard
          icon={<HeartHandshake className="h-4 w-4" />}
          label={`심리상담 매출 (${courseScope === "all" ? "전체" : "최근 30일"})`}
          value={`${data.counseling_revenue.toLocaleString()}원`}
          sub={`강의 ${(totalByCourseRevenue - data.counseling_revenue).toLocaleString()}원`}
        />
      </div>

      {/* 일별 매출 차트 */}
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-sans text-base font-bold text-[var(--color-primary)]">
            최근 {days}일 일별 매출
          </h2>
          <DayRangePicker days={days} onChange={onDaysChange} />
        </div>
        <div className="h-72 w-full min-w-0" style={{ width: "100%", minWidth: 0 }}>
          {mounted ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart
              data={data.daily_revenue}
              margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
            >
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
              {weekendReferenceAreas(data.daily_revenue.map((r) => r.date))}
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
                formatter={(v, name) => [
                  `${Number(v).toLocaleString()}원`,
                  name === "counseling_revenue" ? "심리상담 매출" : "전체 매출",
                ]}
                labelFormatter={(d) => String(d)}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend
                verticalAlign="top"
                height={28}
                formatter={(value: string) =>
                  value === "counseling_revenue" ? "심리상담 매출" : "전체 매출"
                }
                wrapperStyle={{ fontSize: 11 }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name="revenue"
                stroke="#1C3461"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="counseling_revenue"
                name="counseling_revenue"
                stroke="#D9668E"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
          ) : null}
        </div>
        <p className="mt-1 text-right text-[11px] text-zinc-400">
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-orange-500/20 align-middle" />
          주말
        </p>
      </section>

      {/* 연간 매출 — 최근 12개월(이번달 포함) 월별 매출 추이, 기간 선택기(days)와 무관하게 고정 */}
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 font-sans text-base font-bold text-[var(--color-primary)]">
          최근 12개월 월별 매출
        </h2>
        <div className="h-72 w-full min-w-0" style={{ width: "100%", minWidth: 0 }}>
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={data.monthly_revenue}
                margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
              >
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "#71717a" }}
                  tickFormatter={(m: string) => `${Number(m.slice(5))}월`}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#71717a" }}
                  tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}만`}
                  width={48}
                />
                <Tooltip
                  formatter={(v, _n, item) => [
                    `${Number(v).toLocaleString()}원 · ${(
                      (item?.payload as { orders?: number } | undefined)?.orders ?? 0
                    ).toLocaleString()}건`,
                    "매출",
                  ]}
                  labelFormatter={(m) => String(m)}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="revenue" fill="#1C3461" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </section>

      {/* 결제 발생 시간대 (한국 시간) — 일별 매출 그래프와 같은 기간(days) 기준 */}
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 font-sans text-base font-bold text-[var(--color-primary)]">
          최근 {days}일 결제 발생 시간대
        </h2>
        <div className="h-56 w-full min-w-0" style={{ width: "100%", minWidth: 0 }}>
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={data.hourly} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: "#71717a" }}
                  tickFormatter={(h: number) => `${h}시`}
                  interval={1}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#71717a" }}
                  width={32}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(v, _n, item) => [
                    `${Number(v).toLocaleString()}건 · ${(
                      (item?.payload as { revenue?: number } | undefined)?.revenue ?? 0
                    ).toLocaleString()}원`,
                    "결제",
                  ]}
                  labelFormatter={(h) => `${h}시`}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="orders" fill="#1C3461" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>
        <p className="mt-1 text-right text-[11px] text-zinc-400">한국 시간(KST) 기준</p>
      </section>

      <div className="flex items-center justify-end">
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100/80 p-1">
          {(["all", "recent"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onCourseScopeChange(s)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                courseScope === s
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {s === "all" ? "전체" : "최근 30일"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 상품별 판매 현황 */}
        <section className="lg:col-span-2 overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm">
          <header className="border-b border-slate-200/60 px-4 py-3">
            <h2 className="font-sans text-sm font-bold tracking-wide text-slate-800">
              상품별 판매 현황
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {courseScope === "all" ? "전체 기간" : "최근 30일"} paid 기준 · 매출 내림차순
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-slate-200/60 bg-slate-50/50 text-[12px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">강의</th>
                  <th className="px-4 py-3 text-right">건수</th>
                  <th className="px-4 py-3 text-right">매출액</th>
                  <th className="w-32 px-4 py-3 text-right">비율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.by_course.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-12 text-center text-zinc-500">
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
                      <tr key={row.course_title} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {row.course_title}
                          <span className="ml-2 inline-flex items-center whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-inset ring-slate-500/10">
                            {row.category === "심리상담" ? "심리상담" : getTierLabel(row.course_title)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">
                          {row.count.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {row.revenue.toLocaleString()}원
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-10 text-right text-[11px] font-bold text-slate-500">
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

        <div className="space-y-6">
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

        {/* 상품 카테고리(강의 전체보기 탭 기준)별 분포 */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="mb-2 font-sans text-base font-bold text-[var(--color-primary)]">
            상품 카테고리별 분포
          </h2>
          {byTier.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">데이터 없음</p>
          ) : (
            <>
              <div className="h-56 w-full min-w-0" style={{ width: "100%", minWidth: 0 }}>
                {mounted ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Tooltip
                      formatter={(v) => [`${Number(v).toLocaleString()}원`, "매출"]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={24}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                    <Pie
                      data={byTier}
                      dataKey="revenue"
                      nameKey="tier"
                      cx="50%"
                      cy="42%"
                      innerRadius={32}
                      outerRadius={64}
                    >
                      {byTier.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                ) : null}
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {byTier.map((r, i) => (
                  <li
                    key={r.tier}
                    className="flex items-center justify-between border-t border-zinc-100 py-1"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      {r.tier}
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

    </div>
  );
}

function VisitorStatsView({
  visitors,
  mounted,
  days,
  onDaysChange,
}: {
  visitors: VisitorStats | null;
  mounted: boolean;
  days: number;
  onDaysChange: (days: number) => void;
}) {
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
          sub="신규 가입자 중 결제 전환"
        />
        <SummaryCard
          icon={<GraduationCap className="h-4 w-4" />}
          label="평균 수강 강의 수"
          value={`${visitors.avg_courses_per_user.toFixed(1)}건`}
          sub="활성 사용자 1인당"
        />
      </div>

      {/* 일별 신규 가입자 차트 */}
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-sans text-base font-bold text-[var(--color-primary)]">
            최근 {days}일 일별 신규 가입자
          </h2>
          <DayRangePicker days={days} onChange={onDaysChange} />
        </div>
        <div className="h-64 w-full min-w-0" style={{ width: "100%", minWidth: 0 }}>
          {mounted ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart
              data={visitors.daily_signups}
              margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
            >
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
              {weekendReferenceAreas(visitors.daily_signups.map((r) => r.date))}
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#71717a" }}
                tickFormatter={(d: string) => d.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#71717a" }}
                width={32}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(v) => [`${Number(v).toLocaleString()}명`, "신규 가입"]}
                labelFormatter={(d) => String(d)}
                contentStyle={{ fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="new_users"
                stroke="#1C3461"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
          ) : null}
        </div>
        <p className="mt-1 text-right text-[11px] text-zinc-400">
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-orange-500/20 align-middle" />
          주말
        </p>
      </section>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        위 지표는 회원가입 DB 기준입니다. 페이지뷰·세션 등 실시간 트래픽은
        Google Analytics 대시보드에서 확인하세요.{" "}
        <a
          href="https://analytics.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary)] hover:underline"
        >
          analytics.google.com
          <ExternalLink className="h-3 w-3" />
        </a>
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
