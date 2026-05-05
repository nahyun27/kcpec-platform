import { Suspense } from "react";
import CommunityClient from "./_client";

export const metadata = {
  title: "커뮤니티 | KCPEC",
};

export default function Page() {
  return (
    <Suspense
      fallback={<p className="py-20 text-center text-sm text-slate-500">불러오는 중...</p>}
    >
      <CommunityClient />
    </Suspense>
  );
}
