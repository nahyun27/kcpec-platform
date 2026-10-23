import Link from "next/link";
import { Lock } from "lucide-react";

// 결제 버튼 근처에 두는 안심 문구 — 결제는 토스페이먼츠 결제창에서 진행되고
// 카드 정보는 이 사이트에 저장되지 않는다는 사실 + 환불 규정 바로가기(2026-10).
export function PaymentTrustNote({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 text-[11.5px] leading-relaxed text-slate-500 ${className}`}>
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
      <span>
        토스페이먼츠 안전결제로 진행되며 카드 정보는 저장되지 않습니다.{" "}
        <Link href="/guide#refund" className="font-semibold text-slate-600 underline underline-offset-2">
          환불 규정
        </Link>
      </span>
    </p>
  );
}
