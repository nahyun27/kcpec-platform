"use client";

// 광고비 · ROAS (2026-11). 매달 초에 "이달 총 광고비" 하나만 직접 입력한다
// (매체 구분·리포트 업로드 없음 — 변호사님 요청). 총액을 넣은 달은 그 값만 쓰고,
// 총액이 없는 예전 달은 전에 올려 둔 리포트 값을 그대로 보여 준다.

import { useEffect, useState } from "react";
import { getAdminAdSpend, setAdminAdSpendMonth } from "@/lib/api";
import type { AdSpendMonthRow, SalesStatsMonthly } from "@/types/admin";
import { useDialog } from "@/components/ui/DialogProvider";

const TOTAL = "total";

function won(v: number): string {
  return `${v.toLocaleString()}원`;
}

function monthLabel(ym: string): string {
  return `${ym.slice(0, 4)}년 ${Number(ym.slice(5))}월`;
}

export function roas(revenue: number, ad: number): string {
  return ad > 0 ? `${Math.round((revenue / ad) * 100).toLocaleString()}%` : "-";
}

export function AdSpendSection({
  monthly,
  onChanged,
}: {
  monthly: SalesStatsMonthly[];
  onChanged: () => void;
}) {
  const dialog = useDialog();
  const [rows, setRows] = useState<AdSpendMonthRow[] | null>(null);
  const [month, setMonth] = useState(() => {
    // 매달 초에 지난달 합계를 넣으니 기본값은 지난달
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAdminAdSpend()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  const totals = new Map((rows ?? []).filter((r) => r.channel === TOTAL).map((r) => [r.month, r.cost]));
  const current = totals.get(month);

  async function save() {
    const n = Number(cost.replace(/[^0-9]/g, ""));
    if (!month || !cost.trim() || Number.isNaN(n)) return;
    if (n === 0 && current == null) return;
    if (n === 0 && !(await dialog.confirm(`${monthLabel(month)} 광고비 입력값을 지울까요?`))) return;
    setSaving(true);
    try {
      setRows(await setAdminAdSpendMonth(month, TOTAL, n));
      setCost("");
      onChanged();
    } catch {
      await dialog.alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  // 표: 광고비가 있는 달만, 최근 달이 위로
  const table = [...monthly].filter((m) => (m.ad_cost ?? 0) > 0).reverse();
  const hasLegacy = table.some((m) => !totals.has(m.month));

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3">
        <h2 className="font-sans text-base font-bold text-[var(--color-primary)]">광고비 · ROAS (월별)</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          ROAS = 매출 ÷ 광고비. 100%면 쓴 만큼 벌었다는 뜻이에요. 매달 초에 지난달 총 광고비를 넣어 주세요.
        </p>
      </div>

      <div className="mb-4 rounded-md bg-slate-50 p-3">
        <p className="mb-2 text-xs font-semibold text-slate-600">
          이달 총 광고비 입력 <span className="font-normal text-zinc-400">(같은 달을 다시 넣으면 덮어쓰고, 0을 넣으면 삭제)</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm"
          />
          <input
            inputMode="numeric"
            placeholder={current != null ? `현재 ${current.toLocaleString()}` : "총 광고비(원)"}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
            }}
            className="w-40 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving || !cost.trim()}
            className="rounded-md bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
          {current != null ? (
            <span className="text-xs text-slate-500">
              {monthLabel(month)} 입력값: <b className="tabular-nums text-slate-700">{won(current)}</b>
            </span>
          ) : null}
        </div>
      </div>

      {table.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">아직 입력된 광고비가 없어요.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-right text-[13px]">
            <thead className="border-b border-zinc-200 text-[12px] text-zinc-500">
              <tr>
                <th className="py-2 text-left font-semibold">월</th>
                <th className="py-2 font-semibold">매출</th>
                <th className="py-2 font-semibold">광고비</th>
                <th className="py-2 font-semibold">ROAS</th>
                <th className="py-2 font-semibold">매출 대비 광고비</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 tabular-nums">
              {table.map((m) => {
                const ad = m.ad_cost ?? 0;
                const r = ad > 0 ? m.revenue / ad : 0;
                return (
                  <tr key={m.month}>
                    <td className="py-2 text-left font-semibold text-slate-700">
                      {monthLabel(m.month)}
                      {totals.has(m.month) ? null : (
                        <span className="ml-1 text-[11px] font-normal text-zinc-400">*</span>
                      )}
                    </td>
                    <td className="py-2 text-slate-900">{won(m.revenue)}</td>
                    <td className="py-2 font-semibold text-amber-700">{won(ad)}</td>
                    <td className={`py-2 font-bold ${r >= 1 ? "text-emerald-600" : "text-red-600"}`}>
                      {roas(m.revenue, ad)}
                    </td>
                    <td className="py-2 text-slate-500">
                      {m.revenue > 0 ? `${((ad / m.revenue) * 100).toFixed(1)}%` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hasLegacy ? (
            <p className="mt-2 text-[11px] text-zinc-400">
              * 총액을 아직 안 넣은 달은 예전에 올린 대행사 리포트 값이에요. 그 달 총액을 넣으면 입력값으로 바뀝니다.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
