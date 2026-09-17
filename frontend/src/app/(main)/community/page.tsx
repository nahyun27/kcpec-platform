import { Suspense } from "react";
import CommunityClient from "./_client";

export const metadata = {
  title: "커뮤니티 | KCPEC",
  description: "수강 후기, 전문가 칼럼, 공지사항 및 자료실을 확인하세요.",
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
