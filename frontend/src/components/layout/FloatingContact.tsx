import Link from "next/link";
import { MessageSquare, Phone } from "lucide-react";

// 모든 (main) 페이지 우측 하단 고정 상담 버튼 — 1:1 문의(마이페이지, 로그인 필요) + 전화.
export function FloatingContact() {
  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      <a
        href="tel:01063773325"
        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13px] font-bold text-[var(--color-primary)] shadow-lg ring-1 ring-slate-200 transition-transform hover:-translate-y-0.5"
      >
        <Phone className="h-4 w-4" />
        전화 상담
      </a>
      <Link
        href="/mypage?tab=inquiry"
        className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-4 py-2.5 text-[13px] font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5"
      >
        <MessageSquare className="h-4 w-4" />
        1:1 문의
      </Link>
    </div>
  );
}
