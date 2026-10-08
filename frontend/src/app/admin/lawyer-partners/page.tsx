"use client";

import { useEffect, useState } from "react";
import {
  createLawyerPartner,
  deleteLawyerPartner,
  getAdminLawyerPartners,
  patchLawyerPartner,
} from "@/lib/api";
import type { AdminLawyerPartnerRow } from "@/types/admin";
import { useDialog } from "@/components/ui/DialogProvider";

export default function AdminLawyerPartnersPage() {
  const dialog = useDialog();
  const [rows, setRows] = useState<AdminLawyerPartnerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firmName, setFirmName] = useState("");
  const [lawyerName, setLawyerName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  function load() {
    getAdminLawyerPartners()
      .then(setRows)
      .catch(() => setError("파트너 목록을 불러오지 못했습니다."));
  }

  useEffect(load, []);

  async function handleCreate() {
    if (!firmName.trim() || !lawyerName.trim()) return;
    setCreating(true);
    try {
      await createLawyerPartner({ law_firm_name: firmName.trim(), lawyer_name: lawyerName.trim() });
      setFirmName("");
      setLawyerName("");
      load();
    } catch {
      await dialog.alert("파트너 추가에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(row: AdminLawyerPartnerRow) {
    setBusyId(row.id);
    try {
      await patchLawyerPartner(row.id, { is_active: !row.is_active });
      load();
    } catch {
      await dialog.alert("상태 변경에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(row: AdminLawyerPartnerRow) {
    const ok = await dialog.confirm(
      `${row.law_firm_name} ${row.lawyer_name}을(를) 목록에서 삭제하시겠습니까?\n이미 선택해 결제된 주문의 기록은 그대로 남습니다.`,
    );
    if (!ok) return;
    setBusyId(row.id);
    try {
      await deleteLawyerPartner(row.id);
      load();
    } catch {
      await dialog.alert("삭제에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <p className="py-20 text-center text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">
          변호사 파트너 관리
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          파트너를 추가하면 고유 추천 코드가 발급됩니다. 이 코드를 해당 사무실에 전달해
          주세요 — 의뢰인이 결제 화면에서 코드를 입력해 확인되면 10% 할인이 자동
          적용됩니다. 사무실과의 별도 정산은 없고, 목록은 공개되지 않습니다.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-slate-600">법무법인명</label>
          <input
            type="text"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            placeholder="예) 법무법인 정의"
            className="mt-1 rounded border border-zinc-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600">변호사 이름</label>
          <input
            type="text"
            value={lawyerName}
            onChange={(e) => setLawyerName(e.target.value)}
            placeholder="예) 홍길동"
            className="mt-1 rounded border border-zinc-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating || !firmName.trim() || !lawyerName.trim()}
          className="rounded-md bg-[var(--color-primary)] px-4 py-1.5 text-sm font-bold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          {creating ? "추가 중..." : "파트너 추가"}
        </button>
      </div>

      {rows == null ? (
        <p className="text-sm text-zinc-500">불러오는 중...</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
          등록된 파트너가 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-slate-200/60 bg-slate-50/50 text-[12px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">법무법인</th>
                <th className="px-4 py-3">변호사</th>
                <th className="px-4 py-3">추천 코드</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3 text-right">누적 리퍼럴 결제</th>
                <th className="px-4 py-3">등록일</th>
                <th className="px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.law_firm_name}</td>
                  <td className="px-4 py-3 text-slate-700">{r.lawyer_name}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(r.referral_code).catch(() => {});
                      }}
                      title="클릭해서 복사"
                      className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1 font-mono text-xs font-bold tracking-wider text-slate-700 hover:bg-zinc-100"
                    >
                      {r.referral_code}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        r.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-200 text-zinc-600"
                      }`}
                    >
                      {r.is_active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{r.referral_order_count}건</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(r.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleActive(r)}
                        disabled={busyId === r.id}
                        className="rounded border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {r.is_active ? "비활성화" : "활성화"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r)}
                        disabled={busyId === r.id}
                        className="rounded border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
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
