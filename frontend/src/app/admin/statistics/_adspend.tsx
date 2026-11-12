"use client";

// 광고비 · ROAS (2026-11). 대행사 월간 리포트(xlsx)를 올리면 일자별·월별
// 광고비가 저장되고, 리포트가 없는 매체(구글 등)는 월 단위로 직접 입력한다.

import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Upload } from "lucide-react";
import { getAdminAdSpend, setAdminAdSpendMonth, uploadAdminAdSpendReport } from "@/lib/api";
import type { AdSpendMonthRow, SalesStatsMonthly } from "@/types/admin";
import { useDialog } from "@/components/ui/DialogProvider";

const CHANNELS: [string, string][] = [
  ["naver", "네이버"],
  ["google", "구글"],
  ["kakao", "카카오"],
  ["meta", "메타(인스타·페북)"],
  ["other", "기타"],
];

function won(v: number): string {
  return `${v.toLocaleString()}원`;
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<AdSpendMonthRow[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [channel, setChannel] = useState("google");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAdminAdSpend()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  async function upload(file: File) {
    setUploading(true);
    try {
      const r = await uploadAdminAdSpendReport(file);
      setRows(await getAdminAdSpend());
      onChanged();
      await dialog.alert(
        `${r.months[0]} ~ ${r.months[r.months.length - 1]} 광고비를 불러왔어요.\n(일자별 ${r.imported_days}일, 월별 ${r.imported_months}개월)\n\n같은 달을 다시 올리면 최신 값으로 덮어씁니다.`,
      );
    } catch (err) {
      const d = isAxiosError(err) ? (err.response?.data as { detail?: unknown } | undefined)?.detail : null;
      await dialog.alert(typeof d === "string" ? d : "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveManual() {
    const n = Number(cost.replace(/[^0-9]/g, ""));
    if (!month || Number.isNaN(n)) return;
    setSaving(true);
    try {
      setRows(await setAdminAdSpendMonth(month, channel, n));
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
  const channelsUsed = Array.from(
    new Set(table.flatMap((m) => Object.keys(m.ad_cost_by_channel ?? {}))),
  );
  const label = (ch: string) => CHANNELS.find(([k]) => k === ch)?.[1] ?? ch;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-sans text-base font-bold text-[var(--color-primary)]">광고비 · ROAS (월별)</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            ROAS = 매출 ÷ 광고비. 100%면 쓴 만큼 벌었다는 뜻이에요. 광고비는 대행사 리포트 기준(부가세 별도일 수 있음).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3.5 py-2 text-xs font-bold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            <Upload className="h-3.5 w-3.5" /> {uploading ? "불러오는 중..." : "리포트 올리기 (월간·주간)"}
          </button>
        </div>
      </div>

      {table.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          아직 광고비가 없어요. 대행사 월간 리포트(xlsx)를 올리거나 아래에서 직접 입력해 주세요.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-right text-[13px]">
            <thead className="border-b border-zinc-200 text-[12px] text-zinc-500">
              <tr>
                <th className="py-2 text-left font-semibold">월</th>
                <th className="py-2 font-semibold">매출</th>
                {channelsUsed.map((ch) => (
                  <th key={ch} className="py-2 font-semibold">
                    {label(ch)}
                  </th>
                ))}
                <th className="py-2 font-semibold">광고비 합계</th>
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
                      {m.month.slice(0, 4)}년 {Number(m.month.slice(5))}월
                    </td>
                    <td className="py-2 text-slate-900">{won(m.revenue)}</td>
                    {channelsUsed.map((ch) => (
                      <td key={ch} className="py-2 text-slate-600">
                        {m.ad_cost_by_channel?.[ch] ? won(m.ad_cost_by_channel[ch]) : "-"}
                      </td>
                    ))}
                    <td className="py-2 font-semibold text-amber-700">{won(ad)}</td>
                    <td
                      className={`py-2 font-bold ${r >= 1 ? "text-emerald-600" : "text-red-600"}`}
                    >
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
          <p className="mt-2 text-[11px] text-zinc-400">
            같은 달에 월간 리포트가 있으면 월간 값을, 없으면 주간 리포트 합계를 씁니다. 이번 달은 주간 리포트가 올라온 날까지만 반영돼요.
          </p>
        </div>
      )}

      <div className="mt-4 rounded-md bg-slate-50 p-3">
        <p className="mb-2 text-xs font-semibold text-slate-600">
          월 광고비 직접 입력 <span className="font-normal text-zinc-400">(리포트가 없는 매체용, 0을 넣으면 삭제)</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm"
          />
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm"
          >
            {CHANNELS.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            inputMode="numeric"
            placeholder="금액(원)"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-36 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={saveManual}
            disabled={saving || !cost}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
        {rows && rows.length > 0 ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-slate-500">입력된 광고비 기록 {rows.length}건 보기</summary>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {rows.map((r) => (
                <li key={`${r.month}-${r.channel}`} className="flex justify-between gap-2">
                  <span>
                    {r.month} · {r.channel_label}
                    {r.has_daily ? " · 일자별" : r.from_weekly ? " · 주간 리포트" : ""}
                    {r.source === "manual" ? " · 직접 입력" : " · 리포트"}
                  </span>
                  <span className="tabular-nums">
                    {won(r.cost)}
                    {r.clicks != null ? ` · 클릭 ${r.clicks.toLocaleString()}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </section>
  );
}
