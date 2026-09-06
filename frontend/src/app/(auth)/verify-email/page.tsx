import { Suspense } from "react";
import VerifyEmailClient from "./_client";

export default function Page() {
  return (
    <Suspense
      fallback={<p className="py-20 text-center text-sm text-zinc-500">확인 중...</p>}
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
