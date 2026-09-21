"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { confirmDetentionLearning, getMyDetention, tokenStorage } from "@/lib/api";
import { DETENTION_STATUS_LABEL, type DetentionMineRow } from "@/types/detention";
import { useDialog } from "@/components/ui/DialogProvider";

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("ko-KR") : "-";
}

export default function DetentionMyClient() {
  const router = useRouter();
  const dialog = useDialog();
  const [rows, setRows] = useState<DetentionMineRow[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!tokenStorage.getAccess()) {
      router.replace(`/login?next=${encodeURIComponent("/detention/my")}`);
      return;
    }
    getMyDetention()
      .then(setRows)
      .catch(() => setRows([]));
  }, [router]);

  async function handleConfirm(r: DetentionMineRow) {
    const ok = await dialog.confirm(
      `${r.inmate_name}님이 교육자료 학습을 마쳤음을 확인합니다.\n확인 후에는 되돌릴 수 없으며, 확인 내용을 바탕으로 수료증이 발급됩니다. 진행할까요?`,
    );
    if (!ok) return;
    setBusyId(r.id);
    try {
      const updated = await confirmDetentionLearning(r.id);
      setRows((prev) => (prev ?? []).map((x) => (x.id === updated.id ? updated : x)));
      await dialog.alert("학습 완료가 확인되었습니다. 수료증이 발급되면 마이페이지 결제 내역에서 내려받으실 수 있습니다.");
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      await dialog.alert(detail ?? "처리에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-sans text-2xl font-bold text-slate-900">구속수용자 교육 신청 내역</h1>
      <p className="mt-2 text-sm text-slate-500">
        교육자료 발송 후 7일이 지나면 &apos;학습 완료 확인&apos;을 누를 수 있으며, 확인 후 수료증이 발급됩니다.
      </p>

      {!rows ? (
        <p className="py-16 text-center text-sm text-zinc-500">불러오는 중...</p>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
          신청 내역이 없습니다.{" "}
          <Link href="/detention" className="font-bold text-[var(--color-accent)] underline">
            구속수용자 교육 신청하기
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {rows.map((r) => {
            const now = Date.now();
            const availableAt = r.confirm_available_at ? new Date(r.confirm_available_at).getTime() : null;
            const canConfirm =
              r.status === "materials_sent" && !r.learning_confirmed_at && availableAt !== null && now >= availableAt;
            return (
              <li key={r.id} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">수용자 {r.inmate_name}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                    {r.status === "materials_sent" && r.learning_confirmed_at
                      ? "학습 확인 완료(수료증 발급 대기)"
                      : DETENTION_STATUS_LABEL[r.status]}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{r.course_titles.join(", ")}</p>
                <dl className="grid grid-cols-2 gap-1 text-xs text-slate-500">
                  <dt>신청일</dt>
                  <dd className="text-slate-700">{fmt(r.created_at)}</dd>
                  <dt>교육자료 발송일</dt>
                  <dd className="text-slate-700">{fmt(r.materials_sent_at)}</dd>
                  {r.tracking_number ? (
                    <>
                      <dt>송장번호</dt>
                      <dd className="text-slate-700">{r.tracking_number}</dd>
                    </>
                  ) : null}
                </dl>

                {r.status === "received" ? (
                  <p className="text-sm text-slate-500">교육자료 발송을 준비 중입니다.</p>
                ) : r.status === "materials_sent" && !r.learning_confirmed_at ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={!canConfirm || busyId === r.id}
                      onClick={() => handleConfirm(r)}
                      className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyId === r.id ? "처리 중..." : "학습 완료 확인"}
                    </button>
                    {!canConfirm && r.confirm_available_at ? (
                      <p className="text-xs text-slate-500">
                        {fmt(r.confirm_available_at)} 이후에 확인할 수 있습니다.
                      </p>
                    ) : null}
                  </div>
                ) : r.status === "completed" ? (
                  <p className="text-sm font-semibold text-emerald-700">
                    수료증이 발급되었습니다. 마이페이지 결제 내역에서 내려받으실 수 있습니다. ({fmt(r.completed_at)})
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">
                    학습 완료가 확인되었습니다. 수료증이 발급되면 마이페이지 결제 내역에서 내려받으실 수 있습니다.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
