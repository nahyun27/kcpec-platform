"use client";

import { useEffect, useState } from "react";
import {
  approveLawyerPartner,
  createLawyerPartner,
  deleteLawyerPartner,
  getAdminLawyerPartners,
  lawyerPartnerPortalQrUrl,
  patchLawyerPartner,
  regenerateLawyerPartnerCode,
  rejectLawyerPartner,
  sendLawyerPartnerPortalEmail,
} from "@/lib/api";
import type { AdminLawyerPartnerRow, LawyerPartnerStatus } from "@/types/admin";
import { useDialog } from "@/components/ui/DialogProvider";

function portalUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/partner/my/${token}`;
}

const STATUS_BADGE: Record<LawyerPartnerStatus, { label: string; cls: string }> = {
  pending: { label: "승인 대기", cls: "bg-amber-100 text-amber-700" },
  active: { label: "활성", cls: "bg-emerald-100 text-emerald-700" },
  inactive: { label: "비활성", cls: "bg-zinc-200 text-zinc-600" },
  rejected: { label: "반려됨", cls: "bg-red-100 text-red-700" },
};

export default function AdminLawyerPartnersPage() {
  const dialog = useDialog();
  const [rows, setRows] = useState<AdminLawyerPartnerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firmName, setFirmName] = useState("");
  const [lawyerName, setLawyerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editingEmailId, setEditingEmailId] = useState<number | null>(null);
  const [emailDraft, setEmailDraft] = useState("");

  function load() {
    getAdminLawyerPartners()
      .then(setRows)
      .catch(() => setError("파트너 목록을 불러오지 못했습니다."));
  }

  useEffect(load, []);

  async function handleCreate() {
    if (!firmName.trim() || !lawyerName.trim() || !email.trim()) return;
    setCreating(true);
    try {
      await createLawyerPartner({
        law_firm_name: firmName.trim(),
        lawyer_name: lawyerName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
      });
      setFirmName("");
      setLawyerName("");
      setEmail("");
      setPhone("");
      load();
    } catch {
      await dialog.alert("파트너 추가에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  }

  async function handleApprove(row: AdminLawyerPartnerRow) {
    const ok = await dialog.confirm(
      `"${row.law_firm_name} ${row.lawyer_name}" 신청을 승인하시겠습니까?${
        row.email ? `\n승인 즉시 ${row.email} 로 추천 코드·전용 링크가 자동 발송됩니다.` : ""
      }`,
    );
    if (!ok) return;
    setBusyId(row.id);
    try {
      await approveLawyerPartner(row.id);
      load();
    } catch {
      await dialog.alert("승인에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(row: AdminLawyerPartnerRow) {
    const ok = await dialog.confirm(
      `"${row.law_firm_name} ${row.lawyer_name}" 신청을 반려하시겠습니까?`,
    );
    if (!ok) return;
    setBusyId(row.id);
    try {
      await rejectLawyerPartner(row.id);
      load();
    } catch {
      await dialog.alert("반려에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(row: AdminLawyerPartnerRow) {
    setBusyId(row.id);
    try {
      await patchLawyerPartner(row.id, {
        status: row.status === "active" ? "inactive" : "active",
      });
      load();
    } catch {
      await dialog.alert("상태 변경에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRegenerateCode(row: AdminLawyerPartnerRow) {
    const ok = await dialog.confirm(
      `"${row.law_firm_name} ${row.lawyer_name}" 코드를 재발급하시겠습니까?\n기존 코드(${row.referral_code})는 즉시 사용할 수 없게 되며, 재발급 후에는 새 코드를 변호사님께 다시 전달해 주셔야 합니다.`,
    );
    if (!ok) return;
    setBusyId(row.id);
    try {
      await regenerateLawyerPartnerCode(row.id);
      load();
    } catch {
      await dialog.alert("코드 재발급에 실패했습니다.");
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

  function startEditEmail(row: AdminLawyerPartnerRow) {
    setEditingEmailId(row.id);
    setEmailDraft(row.email ?? "");
  }

  async function saveEmail(row: AdminLawyerPartnerRow) {
    setBusyId(row.id);
    try {
      await patchLawyerPartner(row.id, { email: emailDraft.trim() || null });
      setEditingEmailId(null);
      load();
    } catch {
      await dialog.alert("이메일 저장에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSendEmail(row: AdminLawyerPartnerRow) {
    if (!row.email) {
      await dialog.alert("먼저 이메일을 등록해 주세요.");
      return;
    }
    const ok = await dialog.confirm(
      `${row.email} 로 "${row.law_firm_name} ${row.lawyer_name}" 변호사님 전용 링크(추천 코드·QR)를 재발송하시겠습니까?`,
    );
    if (!ok) return;
    setBusyId(row.id);
    try {
      await sendLawyerPartnerPortalEmail(row.id);
      await dialog.alert("재발송했습니다.");
    } catch {
      await dialog.alert("재발송에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function copyPortalLink(row: AdminLawyerPartnerRow) {
    try {
      await navigator.clipboard?.writeText(portalUrl(row.portal_token));
      await dialog.alert("포털 링크를 복사했습니다.");
    } catch {
      /* 클립보드 차단 환경 — 조용히 무시 */
    }
  }

  if (error) return <p className="py-20 text-center text-sm text-red-600">{error}</p>;

  const pendingCount = rows?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">
          변호사 파트너 관리
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          변호사 사무실이 /partner 에서 직접 신청하면 &quot;승인 대기&quot; 상태로 들어옵니다. 승인하면
          추천 코드가 활성화되고, 등록된 이메일로 추천 코드·전용 링크가 자동 발송됩니다.
          전용 링크와 결제용 추천 코드는 서로 다른 값이라 의뢰인이 코드를 알아도 전용
          링크엔 접근할 수 없습니다. 파트너 전체 목록은 공개되지 않습니다.
        </p>
        {pendingCount > 0 ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            승인 대기 중인 신청 {pendingCount}건
          </p>
        ) : null}
      </header>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
        <div className="w-full">
          <h2 className="text-sm font-bold text-slate-800">수동 등록</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            아래 폼은 관리자가 직접 등록하는 용도입니다(승인 절차 없이 바로 활성화).
          </p>
        </div>
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
        <div>
          <label className="block text-xs font-semibold text-slate-600">연락처</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-0000-0000"
            className="mt-1 rounded border border-zinc-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600">이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="lawyer@firm.com"
            className="mt-1 rounded border border-zinc-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating || !firmName.trim() || !lawyerName.trim() || !email.trim()}
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
                <th className="px-4 py-3">연락처</th>
                <th className="px-4 py-3">이메일</th>
                <th className="px-4 py-3">추천 코드</th>
                <th className="px-4 py-3">QR</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3 text-right">누적 리퍼럴 결제</th>
                <th className="px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.law_firm_name}</td>
                  <td className="px-4 py-3 text-slate-700">{r.lawyer_name}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {r.phone ?? <span className="text-zinc-400">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    {editingEmailId === r.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="email"
                          value={emailDraft}
                          onChange={(e) => setEmailDraft(e.target.value)}
                          className="w-40 rounded border border-zinc-300 px-2 py-1 text-xs"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => saveEmail(r)}
                          disabled={busyId === r.id}
                          className="rounded bg-[var(--color-primary)] px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingEmailId(null)}
                          className="text-[11px] text-zinc-400 hover:text-zinc-600"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditEmail(r)}
                        className="text-left text-xs text-slate-600 hover:underline"
                      >
                        {r.email ?? <span className="text-zinc-400">등록 필요</span>}
                      </button>
                    )}
                  </td>
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={lawyerPartnerPortalQrUrl(r.portal_token)}
                      alt={`${r.law_firm_name} 추천 QR`}
                      className="h-12 w-12 rounded border border-zinc-200"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[r.status].cls}`}
                    >
                      {STATUS_BADGE[r.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{r.referral_order_count}건</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {r.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApprove(r)}
                            disabled={busyId === r.id}
                            className="rounded bg-[var(--color-primary)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
                          >
                            승인
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(r)}
                            disabled={busyId === r.id}
                            className="rounded border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            반려
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => copyPortalLink(r)}
                            className="rounded border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                          >
                            포털 링크 복사
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendEmail(r)}
                            disabled={busyId === r.id || !r.email}
                            title={r.email ? undefined : "이메일을 먼저 등록해 주세요"}
                            className="rounded border border-[var(--color-primary)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 disabled:opacity-40"
                          >
                            이메일 재발송
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRegenerateCode(r)}
                            disabled={busyId === r.id}
                            className="rounded border border-amber-300 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                          >
                            코드 재발급
                          </button>
                          {r.status !== "rejected" ? (
                            <button
                              type="button"
                              onClick={() => toggleActive(r)}
                              disabled={busyId === r.id}
                              className="rounded border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                            >
                              {r.status === "active" ? "비활성화" : "활성화"}
                            </button>
                          ) : null}
                        </>
                      )}
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
