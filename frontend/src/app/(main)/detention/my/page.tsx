import { Suspense } from "react";
import DetentionMyClient from "./_client";

export const metadata = { title: "구속수용자 교육 신청 내역 | KCPEC", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>}>
      <DetentionMyClient />
    </Suspense>
  );
}
