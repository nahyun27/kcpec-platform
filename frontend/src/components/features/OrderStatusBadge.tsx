import type { OrderStatus } from "@/types/order";

const STATUS_MAP: Record<OrderStatus, { label: string; cls: string }> = {
  paid: { label: "결제완료", cls: "bg-emerald-100 text-emerald-700" },
  pending: { label: "결제대기", cls: "bg-amber-100 text-amber-700" },
  cancelled: { label: "취소", cls: "bg-zinc-200 text-zinc-700" },
  refunded: { label: "환불", cls: "bg-zinc-200 text-zinc-700" },
};

export function OrderStatusBadge({
  status,
  pendingBank,
}: {
  status: OrderStatus;
  pendingBank?: boolean;
}) {
  if (pendingBank) {
    return (
      <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
        입금 대기
      </span>
    );
  }
  const { label, cls } = STATUS_MAP[status];
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
