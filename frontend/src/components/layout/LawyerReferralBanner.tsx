"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Scale } from "lucide-react";
import { getMyLawyerPartner, tokenStorage, verifyLawyerReferralCode } from "@/lib/api";
import { getCookie, LAWYER_REFERRAL_COOKIE } from "@/lib/cookies";

// 변호사 전용 링크(/r/코드)로 들어온 의뢰인에게 첫 화면부터 할인이 적용된다는
// 걸 보여준다. 결제 화면까지 가야 알 수 있으면 불안해한다는 피드백(2026-10).
// 헤더 "위"에 일반 흐름으로 두는 띠 — 헤더 아래 떠 있게 하면 모바일에서
// 페이지 제목을 가렸고, 히어로들이 헤더 높이만큼만 -mt-16 으로 끌어올려
// 쓰고 있어 헤더 위쪽에 두면 그 계산을 건드리지 않는다.
export function LawyerReferralBanner() {
  const pathname = usePathname();
  const [firmName, setFirmName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      const code = getCookie(LAWYER_REFERRAL_COOKIE);
      if (code) {
        try {
          const p = await verifyLawyerReferralCode(code);
          if (!cancelled) setFirmName(p.law_firm_name);
          return;
        } catch {
          /* 무효/비활성 코드 — 계정 연결 쪽으로 넘어감 */
        }
      }
      if (tokenStorage.getAccess()) {
        const mine = await getMyLawyerPartner().catch(() => null);
        if (!cancelled && mine) setFirmName(mine.law_firm_name);
      }
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!firmName) return null;
  if (pathname.startsWith("/admin") || pathname.startsWith("/partner")) return null;

  return (
    <div className="relative z-[51] bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2 text-center text-xs font-bold text-[#1C3461] sm:text-[13px]">
      <p className="inline-flex items-center gap-1.5">
        <Scale className="h-3.5 w-3.5 shrink-0" />
        <span>{firmName} 소개 · 결제 시 10% 할인 자동 적용</span>
      </p>
    </div>
  );
}
