import { Suspense } from "react";
import DetentionSuccessClient from "./_client";

export const metadata = { robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>}>
      <DetentionSuccessClient />
    </Suspense>
  );
}
