"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { tokenStorage } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";

/**
 * 백엔드 OAuth callback 이 redirect 한 후 도착하는 페이지.
 * 토큰은 URL fragment(#access_token=...&refresh_token=...) 로 전달된다.
 * → tokenStorage 에 저장하고 history 에서 즉시 fragment 제거 후 /mypage 이동.
 */
export default function SocialCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const access = params.get("access_token");
    const refresh = params.get("refresh_token");

    if (!access || !refresh) {
      setError("로그인 토큰을 받지 못했습니다. 다시 시도해 주세요.");
      return;
    }

    tokenStorage.set({ access_token: access, refresh_token: refresh });

    // fragment 를 history 에서 제거 후 mypage 로 이동.
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    router.replace("/mypage");
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
