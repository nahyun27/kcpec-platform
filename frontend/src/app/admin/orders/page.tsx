"use client";

import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isAxiosError } from "axios";
import {
  absUrl,
  cancelAdminOrder,
  confirmBankOrder,
  correctAdminCertificate,
  exportAdminCertificate,
  getAdminOrderBundleSiblings,
  getAdminOrderDocuments,
  getAdminOrders,
  getAdminUser,
  refundAdminOrder,
  uploadFinalCertificate,
} from "@/lib/api";
import type { AdminOrderRow, AdminOrdersResponse, AdminUser } from "@/types/admin";
import { PAYMENT_METHOD_LABEL, type DocumentResponse, type OrderStatus } from "@/types/order";
import { useDialog } from "@/components/ui/DialogProvider";
import { UserEnrollmentsModal } from "@/components/features/UserEnrollmentsModal";
import { OrderStatusBadge } from "@/components/features/OrderStatusBadge";

type FilterValue = OrderStatus | "all";

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "paid", label: "결제완료" },
  { value: "pending", label: "입금대기" },
  { value: "cancelled", label: "취소" },
  { value: "refunded", label: "환불" },
];

function isFilterValue(v: unknown): v is FilterValue {
  return (
    v === "all" ||
    v === "paid" ||
    v === "pending" ||
    v === "cancelled" ||
    v === "refunded"
  );
}

export default function AdminOrdersPageWrapper() {
  // useSearchParams 사용을 위해 Suspense 경계 필요
  return (
    <Suspense fallback={null}>
      <AdminOrdersPage />
    </Suspense>
  );
}

function AdminOrdersPage() {
  const dialog = useDialog();
  const search = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const statusParam = search.get("status");
  const filter: FilterValue = isFilterValue(statusParam) ? statusParam : "all";

  const [page, setPage] = useState(1);
  const size = 50;

  function setFilter(next: FilterValue) {
    const params = new URLSearchParams(search.toString());
    if (next === "all") params.delete("status");
    else params.set("status", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setPage(1);
  }

  const [data, setData] = useState<AdminOrdersResponse | null>(null);

  // 묶음결제(같은 bundle_id) 주문끼리는 목록에서 항상 붙어서 나온다(주문일시
  // 내림차순 정렬 + 같은 결제 세션은 같은 created_at). 전부 같은 인디고색 바로
  // 표시하되, 바로 옆에 다른 묶음이 바로 이어지는 경우에만 그 사이에 얇은 흰
  // 여백 행을 넣어 두 묶음의 바가 하나로 이어져 보이지 않게 한다(2026-09,
  // 실사용 중 발견 — 색만으로 구분하면 옆 묶음까지 하나로 이어진 것처럼 보임).
  const rowMeta = useMemo(() => {
    const items = data?.items ?? [];
    // 묶음별 합계(정가 합/실결제 합/할인) — 묶음결제 할인(10만원 이상 시
    // 1만원)이 마지막 항목 하나에 전액 몰려 그 항목만 정가보다 훨씬 낮게(0원
    // 까지) 찍힐 수 있어, 항목 하나하나가 아니라 고객명 칸(묶음 전체를
    // rowSpan 으로 덮는 칸이라 여유 공간이 있음)에 "묶음 합계 120,000원
    // -10,000원 = 110,000원" 형태로 한 번에 보여준다(2026-09, "반성문이
    // 0원으로 결제됐다" 문의로 발견 — 실제로는 결제/가격 모두 정상이고
    // 할인이 그 항목에 반영된 것뿐이었음. 처음엔 금액 칸 마지막 줄에 넣었으나
    // 좁아 보인다는 피드백으로 고객명 칸으로 이동).
    const bundleTotals = new Map<string, { subtotal: number; total: number; discount: number }>();
    for (const r of items) {
      if (!r.bundle_id) continue;
      const t = bundleTotals.get(r.bundle_id) ?? { subtotal: 0, total: 0, discount: 0 };
      t.subtotal += r.course_price ?? r.amount;
      t.total += r.amount;
      bundleTotals.set(r.bundle_id, t);
    }
    for (const t of bundleTotals.values()) t.discount = t.subtotal - t.total;

    return items.map((r, idx) => {
      if (!r.bundle_id) return null;
      const prev = items[idx - 1];
      const next = items[idx + 1];
      const isGroupStart = prev?.bundle_id !== r.bundle_id;
      const groupSize = items.slice(idx).findIndex((x) => x.bundle_id !== r.bundle_id);
      return {
        isGroupStart,
        // 바로 앞줄이 "다른" 묶음결제였을 때만 여백 행이 필요 — 앞줄이 묶음이
        // 아닌 단건 주문이면 이미 바가 끊겨 있어 여백이 필요 없다.
        needsGapBefore: isGroupStart && !!prev?.bundle_id,
        groupSize: groupSize === -1 ? items.length - idx : groupSize,
        bundleTotal: bundleTotals.get(r.bundle_id),
      };
    });
  }, [data]);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [mutatingId, setMutatingId] = useState<number | null>(null);
  const [openUser, setOpenUser] = useState<AdminUser | null>(null);
  const [docsOrder, setDocsOrder] = useState<AdminOrderRow | null>(null);

  async function load() {
    setError(null);
    try {
      const d = await getAdminOrders({
        status: filter === "all" ? undefined : filter,
        page,
        size,
      });
      setData(d);
    } catch {
      setError("주문 목록을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page]);

  async function handleConfirm(row: AdminOrderRow) {
    if (
      !(await dialog.confirm(
        `주문 #${row.id} (${row.name ?? row.username})의 입금을 확인 처리하시겠습니까?`,
      ))
    )
      return;
    setConfirmingId(row.id);
    try {
      await confirmBankOrder(row.id);
      await load();
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      await dialog.alert(detail ?? "입금 확인에 실패했습니다.");
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleCancel(row: AdminOrderRow) {
    if (!(await dialog.confirm(`주문 #${row.id} (${row.name ?? row.username})을(를) 취소하시겠습니까?`))) return;
    setMutatingId(row.id);
    try {
      await cancelAdminOrder(row.id);
      await load();
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      await dialog.alert(detail ?? "취소에 실패했습니다.");
    } finally {
      setMutatingId(null);
    }
  }

  async function handleRefund(row: AdminOrderRow) {
    // 카드/간편결제(토스) 는 이 버튼으로 실제 결제 취소(고객에게 실제 환불)까지
    // 자동으로 처리된다. 가상계좌(무통장입금)는 토스를 거치긴 하지만, 토스
    // 결제취소 API가 가상계좌 건에는 환불받을 계좌 정보를 필수로 요구하는데
    // 그 입력 UI가 아직 없어 자동화 대상에서 제외해뒀다 — 계좌로 직접
    // 환불해야 한다(관리자가 헷갈리지 않도록 안내에 명시, 2026-09).
    const paymentNote =
      row.payment_method === "bank_transfer"
        ? "가상계좌 건은 자동으로 환불되지 않으니, 계좌로 직접 환불해 주세요."
        : "토스 결제가 자동으로 취소되어 고객에게 실제 환불됩니다.";

    // 묶음결제는 토스 결제취소가 결제 1건(=묶음 전체) 단위라, 이 주문 하나만
    // 골라 환불해도 실제로는 같은 bundle_id 의 PAID 주문 전체가 함께
    // REFUNDED 된다(백엔드 refund_order). 예전엔 확인창이 "주문 #123을
    // 환불 처리하시겠습니까?"라고 단수형으로만 물어봐서, 관리자가 이미
    // 발급·발송까지 끝낸 다른 과정(구속수용자 교육처럼 과정별로 시차를 두고
    // 처리하는 경우 특히 흔함)까지 같이 취소되는 걸 모른 채 눌러버릴 수
    // 있었다(2026-09, 버그 감사 중 발견) — 실제로 같이 환불될 항목을
    // 미리 보여준다.
    let bundleWarning = "";
    if (row.bundle_id) {
      try {
        const siblings = await getAdminOrderBundleSiblings(row.bundle_id);
        const others = siblings.filter((s) => s.order_id !== row.id);
        if (others.length > 0) {
          const lines = others
            .map(
              (s) =>
                `  · ${s.course_title} (${s.amount.toLocaleString()}원)${
                  s.has_issued_document ? " — 이미 발급된 서류 있음!" : ""
                }`,
            )
            .join("\n");
          bundleWarning =
            `\n\n⚠ 묶음결제 항목이라 이 주문뿐 아니라 아래 ${others.length}건도 함께 환불되고,` +
            ` 발급된 서류가 있다면 함께 무효화됩니다:\n${lines}`;
        }
      } catch {
        // 확인창 보강용 부가 조회 — 실패해도 환불 자체는 계속 진행 가능해야 하므로 조용히 무시.
      }
    }

    if (
      !(await dialog.confirm(
        `주문 #${row.id} (${row.name ?? row.username})을(를) 환불 처리하시겠습니까?\n${paymentNote}\n수강 등록이 취소되고, 이미 발급된 서류가 있다면 함께 무효화됩니다.${bundleWarning}`,
      ))
    )
      return;
    setMutatingId(row.id);
    try {
      await refundAdminOrder(row.id);
      await load();
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      await dialog.alert(detail ?? "환불 처리에 실패했습니다.");
    } finally {
      setMutatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">주문</h1>
        <p className="mt-1 text-sm text-zinc-500">
          전체 주문 내역 / 가상계좌 입금 확인 / 발급 문서 조회
          {data ? <> · 총 {data.total.toLocaleString()}건</> : null}
        </p>
      </header>

      <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100/80 p-1.5 shadow-inner">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all ${
                active
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5"
                  : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="py-10 text-center text-sm text-red-600">{error}</p>
      ) : !data ? (
        <p className="py-10 text-center text-sm text-zinc-500">불러오는 중...</p>
      ) : data.items.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">주문이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-slate-200/60 bg-slate-50/50 text-[12px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">주문일시</th>
                <th className="px-4 py-3">고객</th>
                <th className="px-4 py-3">강의명</th>
                <th className="px-4 py-3">결제수단</th>
                <th className="px-4 py-3 text-right">금액</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((r, idx) => {
                const isPendingBank =
                  r.status === "pending" && r.payment_method === "bank_transfer";
                const meta = rowMeta[idx];
                const isBundled = !!meta;
                return (
                  <Fragment key={r.id}>
                    {meta?.needsGapBefore ? (
                      <tr aria-hidden="true">
                        <td colSpan={7} className="h-2 border-none bg-white p-0" />
                      </tr>
                    ) : null}
                    <tr
                      className={`transition-colors hover:bg-slate-50/80 ${
                        isPendingBank ? "bg-amber-50/40" : meta ? "bg-indigo-50/40" : ""
                      } ${meta ? "border-l-[3px] border-l-indigo-400" : ""}`}
                    >
                    {!isBundled || meta.isGroupStart ? (
                      <>
                        <td
                          className="px-4 py-3 align-top text-slate-500"
                          rowSpan={meta ? meta.groupSize : undefined}
                        >
                          <div className="whitespace-nowrap">
                            {new Date(r.created_at).toLocaleString("ko-KR")}
                          </div>
                          {/* 묶음결제 할인(10만원 이상 시 1만원)이 항목 중 하나에 전액 몰려
                              그 항목만 0원까지 찍힐 수 있어 "정가 대비 할인"을 보여준다.
                              항목별 금액 칸이 아니라 여기(주문일시 칸, 묶음 전체를 rowSpan
                              으로 덮는 자리)에 한 번만 표시 — 같은 시각(created_at)에 생성된
                              묶음 항목끼리는 목록 정렬에서 순서가 보장되지 않아, 할인이 실제로
                              적용된 항목이 매번 다른 위치에 나올 수 있다(2026-09, "반성문이
                              0원인데 할인 표시가 안 보인다" 문의로 발견). 고객명 칸에 두면 그
                              칸 너비가 늘어나면서 상태 칸의 "결제완료" 등이 줄바꿈되는 문제가
                              있어 날짜 칸으로 옮김. */}
                          {meta?.bundleTotal && meta.bundleTotal.discount > 0 ? (
                            <div className="mt-1 whitespace-normal text-[11px] font-medium text-zinc-400">
                              묶음 합계 {meta.bundleTotal.subtotal.toLocaleString()}원{" "}
                              <span className="text-rose-500">
                                -{meta.bundleTotal.discount.toLocaleString()}원
                              </span>{" "}
                              = {meta.bundleTotal.total.toLocaleString()}원
                            </div>
                          ) : null}
                        </td>
                        <td
                          className="px-4 py-3 align-top font-semibold text-slate-900"
                          rowSpan={meta ? meta.groupSize : undefined}
                        >
                          <button
                            type="button"
                            onClick={() => getAdminUser(r.user_id).then(setOpenUser).catch(() => {})}
                            className="hover:text-[var(--color-primary)] hover:underline"
                          >
                            {r.name ?? r.username}
                          </button>
                          <div className="mt-0.5 font-normal text-slate-400">
                            {r.email ?? "-"}
                          </div>
                          {meta ? (
                            <span
                              title={`묶음결제 ID: ${r.bundle_id}`}
                              className="mt-1 block w-fit rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700"
                            >
                              묶음결제 {meta.groupSize}건
                            </span>
                          ) : null}
                        </td>
                      </>
                    ) : null}
                    <td className="px-4 py-3 text-slate-700">
                      {r.course_title}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {PAYMENT_METHOD_LABEL[r.payment_method]}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-bold text-slate-900">{r.amount.toLocaleString()}원</div>
                      {/* 묶음 합계(고객명 칸)는 전체 그림만 보여줄 뿐, 정작 할인이 몰린
                          "이 항목"이 왜 0원인지는 그 줄 자체에도 표시가 필요하다는
                          피드백으로 묶음 여부와 무관하게 보여준다(2026-09). */}
                      {r.course_price != null && r.course_price > r.amount ? (
                        <div className="text-[11px] font-medium text-zinc-400">
                          정가 {r.course_price.toLocaleString()}원 ·{" "}
                          <span className="text-rose-500">
                            -{(r.course_price - r.amount).toLocaleString()}원 할인
                          </span>
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <OrderStatusBadge status={r.status} pendingBank={isPendingBank} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {isPendingBank ? (
                          <button
                            type="button"
                            onClick={() => handleConfirm(r)}
                            disabled={confirmingId === r.id || mutatingId === r.id}
                            className="rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                          >
                            {confirmingId === r.id ? "처리 중..." : "입금 확인"}
                          </button>
                        ) : null}
                        {r.status === "paid" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setDocsOrder(r)}
                              className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                            >
                              발급 현황
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRefund(r)}
                              disabled={mutatingId === r.id}
                              className="rounded-md border border-red-200 px-3 py-1.5 text-[11px] font-bold text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-60"
                            >
                              {mutatingId === r.id ? "처리 중..." : "환불"}
                            </button>
                          </>
                        ) : null}
                        {r.status === "pending" ? (
                          <button
                            type="button"
                            onClick={() => handleCancel(r)}
                            disabled={confirmingId === r.id || mutatingId === r.id}
                            className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60"
                          >
                            {mutatingId === r.id ? "처리 중..." : "주문 취소"}
                          </button>
                        ) : null}
                        {r.status !== "pending" && r.status !== "paid" ? (
                          <span className="text-xs text-slate-300">—</span>
                        ) : null}
                      </div>
                    </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > size ? (
        <div className="flex items-center justify-end gap-3 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
          >
            이전
          </button>
          <span className="font-medium text-slate-500">
            {page} <span className="mx-1 font-normal text-slate-300">/</span>{" "}
            {Math.max(1, Math.ceil(data.total / size))}
          </span>
          <button
            type="button"
            onClick={() =>
              setPage((p) => Math.min(Math.ceil(data.total / size), p + 1))
            }
            disabled={page >= Math.ceil(data.total / size)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
          >
            다음
          </button>
        </div>
      ) : null}

      {docsOrder ? (
        <DocumentsModal order={docsOrder} onClose={() => setDocsOrder(null)} />
      ) : null}
      {openUser ? (
        <UserEnrollmentsModal user={openUser} onClose={() => setOpenUser(null)} />
      ) : null}
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function errMsg(err: unknown, fallback: string): string {
  const detail = isAxiosError(err)
    ? (err.response?.data as { detail?: unknown } | undefined)?.detail
    : null;
  return typeof detail === "string" ? detail : fallback;
}

function DocumentsModal({
  order,
  onClose,
}: {
  order: AdminOrderRow;
  onClose: () => void;
}) {
  const [docs, setDocs] = useState<DocumentResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editBirth, setEditBirth] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  function load() {
    getAdminOrderDocuments(order.id)
      .then(setDocs)
      .catch(() => setError("문서 목록을 불러오지 못했습니다."));
  }

  useEffect(load, [order.id]);

  function startEdit(d: DocumentResponse) {
    setEditingId(d.id);
    setEditName(d.recipient_name);
    setEditBirth(d.recipient_birth);
    setActionError(null);
  }

  async function saveEdit(docId: number) {
    const key = `edit-${docId}`;
    setBusyKey(key);
    setActionError(null);
    try {
      await correctAdminCertificate(docId, {
        recipient_name: editName,
        recipient_birth: editBirth,
      });
      setEditingId(null);
      load();
    } catch (err) {
      setActionError(errMsg(err, "정정에 실패했습니다."));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleExport(d: DocumentResponse, target: "certificate" | "pledge") {
    const key = `export-${d.id}-${target}`;
    setBusyKey(key);
    setActionError(null);
    try {
      const blob = await exportAdminCertificate(d.id, target);
      const label = target === "pledge" ? "서약서" : "수료증";
      downloadBlob(blob, `${label}_${d.recipient_name}_${d.issue_number}.pptx`);
    } catch (err) {
      setActionError(errMsg(err, "파워포인트 다운로드에 실패했습니다."));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleUpload(d: DocumentResponse, target: "certificate" | "pledge", file: File) {
    const key = `upload-${d.id}-${target}`;
    setBusyKey(key);
    setActionError(null);
    try {
      await uploadFinalCertificate(d.id, target, file);
      load();
    } catch (err) {
      setActionError(errMsg(err, "최종본 업로드에 실패했습니다."));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="font-sans text-lg font-bold text-[var(--color-primary)]">
            발급 문서
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-900"
          >
            닫기
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          주문 #{order.id} · {order.name ?? order.username} · {order.course_title}
        </p>

        <div className="mt-4">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : docs == null ? (
            <p className="text-sm text-zinc-500">불러오는 중...</p>
          ) : docs.length === 0 ? (
            <p className="text-sm text-zinc-500">발급된 문서가 없습니다.</p>
          ) : (
            <ul className="space-y-3">
              {docs.map((d) => (
                <li key={d.id} className="rounded border border-zinc-200 px-3 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{d.issue_number}</p>
                      <p className="text-xs text-zinc-500">
                        {d.document_type} · {d.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {d.pdf_url ? (
                        <a
                          href={absUrl(d.pdf_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)]"
                        >
                          수료증 보기
                        </a>
                      ) : null}
                      {d.pledge_pdf_url ? (
                        <a
                          href={absUrl(d.pledge_pdf_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded border border-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)] hover:bg-blue-50"
                        >
                          서약서 보기
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {d.document_type === "certificate" && d.status !== "revoked" ? (
                    <div className="mt-2.5 border-t border-zinc-100 pt-2.5">
                      {editingId === d.id ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="수령인 이름"
                            className="w-28 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                          <input
                            type="date"
                            value={editBirth}
                            onChange={(e) => setEditBirth(e.target.value)}
                            className="rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            disabled={busyKey === `edit-${d.id}`}
                            onClick={() => saveEdit(d.id)}
                            className="rounded bg-[var(--color-primary)] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-xs text-zinc-500 hover:text-zinc-900"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                          <span>
                            수령인 {d.recipient_name} · 생년월일 {d.recipient_birth}
                          </span>
                          <button
                            type="button"
                            onClick={() => startEdit(d)}
                            className="font-semibold text-[var(--color-primary)] hover:underline"
                          >
                            정정
                          </button>
                        </div>
                      )}

                      <p className="mt-2 text-[11px] font-semibold text-zinc-400">
                        발급 후 오타 정정 — 파워포인트 다운로드 후 직접 수정해 최종 PDF로
                        재업로드하면 고객 다운로드에 반영됩니다.
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busyKey === `export-${d.id}-certificate`}
                          onClick={() => handleExport(d, "certificate")}
                          className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                        >
                          수료증 PPT 다운로드
                        </button>
                        <button
                          type="button"
                          disabled={busyKey === `upload-${d.id}-certificate`}
                          onClick={() => fileInputs.current[`${d.id}-certificate`]?.click()}
                          className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                        >
                          수료증 최종본 업로드
                        </button>
                        <input
                          ref={(el) => {
                            fileInputs.current[`${d.id}-certificate`] = el;
                          }}
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) handleUpload(d, "certificate", file);
                          }}
                        />
                        <span className="mx-1 text-zinc-300">|</span>
                        <button
                          type="button"
                          disabled={busyKey === `export-${d.id}-pledge`}
                          onClick={() => handleExport(d, "pledge")}
                          className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                        >
                          서약서 PPT 다운로드
                        </button>
                        <button
                          type="button"
                          disabled={busyKey === `upload-${d.id}-pledge`}
                          onClick={() => fileInputs.current[`${d.id}-pledge`]?.click()}
                          className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                        >
                          서약서 최종본 업로드
                        </button>
                        <input
                          ref={(el) => {
                            fileInputs.current[`${d.id}-pledge`] = el;
                          }}
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) handleUpload(d, "pledge", file);
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {actionError ? <p className="mt-2 text-xs text-red-600">{actionError}</p> : null}
        </div>
      </div>
    </div>
  );
}
