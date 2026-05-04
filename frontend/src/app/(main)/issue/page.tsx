import { Suspense } from "react";
import IssueClient from "./_client";

export default function Page() {
  return (
    <Suspense
      fallback={<p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>}
    >
      <IssueClient />
    </Suspense>
  );
}
