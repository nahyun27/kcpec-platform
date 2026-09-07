"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getMe, tokenStorage } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";

/**
 * 백엔드 OAuth callback 이 redirect 한 후 도착하는 페이지.
 * 로그인 세션은 callback 응답의 Set-Cookie 로 이미 httpOnly 쿠키에 실려
 * 도착해 있으므로, 여기서는 실제로 로그인이 됐는지만 /auth/me 로 확인한다.
 */
export default function SocialCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then(() => {
        tokenStorage.set();
        router.replace("/mypage");
      })
      .catch(() => {
        setError("로그인에 실패했습니다. 다시 시도해 주세요.");
      });
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-semibold text-red-600">{error}</p>
        <Link
          href="/login"
          className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          로그인 페이지로
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Spinner size="md" tone="primary" />
      <p className="text-sm font-medium text-slate-500">로그인 처리 중입니다...</p>
    </div>
  );
}
