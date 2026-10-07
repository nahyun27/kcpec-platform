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
    // 입금 확인은 토스 웹훅이 자동 처리하고 관리자가 직접 조치할 일이
    // 없는 정상 대기 상태라, "문제 발생"을 뜻하는 빨강 대신 다른 대기
    // 상태(결제대기)와 같은 노랑 계열로 통일한다(2026-10).
    return (
      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
        입금 대기
      </span>
    );
  }
  const { label, cls } = STATUS_MAP[status];
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
