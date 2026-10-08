import { Suspense } from "react";
import LawyerPortalClient from "./_client";

export const metadata = { title: "변호사 파트너 안내 | KCPEC", robots: { index: false } };

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <Suspense fallback={<p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>}>
      <LawyerPortalClient token={token} />
    </Suspense>
  );
}
