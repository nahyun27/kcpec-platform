import { CreditCard, Landmark, Smartphone, Zap } from "lucide-react";
import type { PaymentMethod } from "@/types/order";

// 결제 수단 버튼 아이콘 — 강의 단건·묶음 결제 화면이 같이 쓴다.
export function PaymentMethodIcon({
  method,
  selected,
}: {
  method: PaymentMethod;
  selected: boolean;
}) {
  if (method === "kakaopay") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#FEE500]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/kakao.svg" alt="" className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (method === "naverpay") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#03C75A]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/naver.svg" alt="" className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (method === "tosspay") {
    return (
      <span className="flex h-6 w-6 items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/toss.png" alt="" className="h-6 w-6" />
      </span>
    );
  }
  if (method === "payco") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#FA2828] text-[7px] font-black tracking-tight text-white">
        PAYCO
      </span>
    );
  }
  if (method === "lpay") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[#1E5BD8] bg-white text-[7px] font-black text-[#1E5BD8]">
        L.PAY
      </span>
    );
  }
  if (method === "ssgpay") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#FF5452] text-[8px] font-black text-white">
        SSG
      </span>
    );
  }
  if (method === "samsungpay") {
    return (
      <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/samsungpay.png" alt="" className="h-6 w-6" />
      </span>
    );
  }
  const cls = `h-6 w-6 ${selected ? "text-[var(--color-primary)]" : "text-slate-400"}`;
  if (method === "mobile_phone") return <Smartphone className={cls} />;
  if (method === "transfer") return <Zap className={cls} />;
  if (method === "bank_transfer") return <Landmark className={cls} />;
  return <CreditCard className={cls} />;
}
