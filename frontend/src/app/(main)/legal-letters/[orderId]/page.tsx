import { Suspense } from "react";
import LegalLetterClient from "./_client";

export const metadata = { title: "반성문·탄원서 작성 | KCPEC", robots: { index: false } };

export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return (
    <Suspense fallback={<p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>}>
      <LegalLetterClient orderId={Number(orderId)} />
    </Suspense>
  );
}
