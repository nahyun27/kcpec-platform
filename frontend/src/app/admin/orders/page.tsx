"use client";

import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isAxiosError } from "axios";
import {
  absUrl,
  cancelAdminOrder,
  confirmBankOrder,
  getAdminOrderDocuments,
  getAdminOrders,
  getAdminUser,
  refundAdminOrder,
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
    return items.map((r, idx) => {
      if (!r.bundle_id) return null;
      const prev = items[idx - 1];
      const isGroupStart = prev?.bundle_id !== r.bundle_id;
      const groupSize = items.slice(idx).findIndex((x) => x.bundle_id !== r.bundle_id);
      return {
        isGroupStart,
        // 바로 앞줄이 "다른" 묶음결제였을 때만 여백 행이 필요 — 앞줄이 묶음이
        // 아닌 단건 주문이면 이미 바가 끊겨 있어 여백이 필요 없다.
        needsGapBefore: isGroupStart && !!prev?.bundle_id,
        groupSize: groupSize === -1 ? items.length - idx : groupSize,
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
    if (
      !(await dialog.confirm(
        `주문 #${row.id} (${row.name ?? row.username})을(를) 환불 처리하시겠습니까?\n${paymentNote}\n수강 등록이 취소되고, 이미 발급된 서류가 있다면 함께 무효화됩니다.`,
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
                <th className="px-4 py-3">고객명</th>
                <th className="px-4 py-3">이메일</th>
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
                        <td colSpan={8} className="h-2 border-none bg-white p-0" />
                      </tr>
                    ) : null}
                    <tr
                      className={`transition-colors hover:bg-slate-50/80 ${
                        isPendingBank ? "bg-red-50/40" : meta ? "bg-indigo-50/40" : ""
                      } ${meta ? "border-l-[3px] border-l-indigo-400" : ""}`}
                    >
                    {!isBundled || meta.isGroupStart ? (
                      <>
                        <td
                          className="px-4 py-3 align-top text-slate-500"
                          rowSpan={meta ? meta.groupSize : undefined}
                        >
                          {new Date(r.created_at).toLocaleString("ko-KR")}
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
                          {meta ? (
                            <span
                              title={`묶음결제 ID: ${r.bundle_id}`}
                              className="mt-1 block w-fit rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700"
                            >
                              묶음결제 {meta.groupSize}건
                            </span>
                          ) : null}
                        </td>
                        <td
                          className="px-4 py-3 align-top text-slate-500"
                          rowSpan={meta ? meta.groupSize : undefined}
                        >
                          {r.email ?? "-"}
                        </td>
                      </>
                    ) : null}
                    <td className="px-4 py-3 text-slate-700">
                      {r.course_title}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {PAYMENT_METHOD_LABEL[r.payment_method]}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {r.amount.toLocaleString()}원
                    </td>
                    <td className="px-4 py-3">
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

function DocumentsModal({
  order,
  onClose,
}: {
  order: AdminOrderRow;
  onClose: () => void;
}) {
  const [docs, setDocs] = useState<DocumentResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminOrderDocuments(order.id)
      .then(setDocs)
      .catch(() => setError("문서 목록을 불러오지 못했습니다."));
  }, [order.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
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
            <ul className="space-y-2">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-200 px-3 py-2 text-sm"
                >
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
                        수료증
                      </a>
                    ) : null}
                    {d.pledge_pdf_url ? (
                      <a
                        href={absUrl(d.pledge_pdf_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded border border-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)] hover:bg-blue-50"
                      >
                        서약서
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
