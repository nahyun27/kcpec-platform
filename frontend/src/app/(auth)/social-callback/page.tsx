"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getMe, tokenStorage, updateMe } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";
import { SOCIAL_NEXT_KEY } from "../_social";

// login/_client.tsx 의 safeNext 와 동일 — 같은 origin 의 절대경로만 허용.
function takeSafeNext(): string {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(SOCIAL_NEXT_KEY);
    sessionStorage.removeItem(SOCIAL_NEXT_KEY);
  } catch {
    /* 저장소 차단 환경 */
  }
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/mypage";
  return raw;
}

/**
 * 백엔드 OAuth callback 이 redirect 한 후 도착하는 페이지.
 * 로그인 세션은 callback 응답의 Set-Cookie 로 이미 httpOnly 쿠키에 실려
 * 도착해 있으므로, 여기서는 실제로 로그인이 됐는지만 /auth/me 로 확인한다.
 */
export default function SocialCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // 소셜 가입은 우리 가입 화면을 거치지 않아 수신 동의를 물을 자리가 없다 —
  // 아직 한 번도 묻지 않은 계정(null)이면 여기서 한 번만 묻고 넘어간다.
  const [askConsent, setAskConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMe()
      .then((me) => {
        tokenStorage.set();
        if (me.marketing_consent === null) setAskConsent(true);
        else router.replace(takeSafeNext());
      })
      .catch(() => {
        setError("로그인에 실패했습니다. 다시 시도해 주세요.");
      });
  }, [router]);

  async function answer(consent: boolean) {
    setSaving(true);
    await updateMe({ marketing_consent: consent }).catch(() => {});
    router.replace(takeSafeNext());
  }

  if (askConsent) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="font-sans text-lg font-bold text-slate-900">가입을 환영합니다!</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            수료증 준비에 도움 되는 혜택·안내 메일을 받으시겠어요?
            <span className="mt-1 block text-xs text-slate-400">
              (선택) 마이페이지에서 언제든 바꿀 수 있어요.
            </span>
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => answer(false)}
              className="flex-1 rounded-xl border border-zinc-300 bg-white py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              괜찮아요
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => answer(true)}
              className="flex-1 rounded-xl bg-[var(--color-primary)] py-2.5 text-sm font-bold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
            >
              받을게요
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-semibold text-red-600">{error}</p>
        {/* social_error 를 붙여야 로그인 페이지가 떠나기 전 적어둔 목적지(결제
            화면 등)를 되살린다 */}
        <Link
          href="/login?social_error=fail"
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
