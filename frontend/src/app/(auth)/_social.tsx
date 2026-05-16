"use client";

import { useSearchParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";

type Provider = "kakao" | "naver" | "google";

const PROVIDERS: { key: Provider; label: string; icon: string; cls: string }[] = [
  {
    key: "kakao",
    label: "카카오로 시작하기",
    icon: "/icons/kakao.svg",
    cls: "bg-[#FEE500] text-[#191919] hover:brightness-95",
  },
  {
    key: "naver",
    label: "네이버로 시작하기",
    icon: "/icons/naver.svg",
    cls: "bg-[#03C75A] text-white hover:brightness-95",
  },
  {
    key: "google",
    label: "Google로 시작하기",
    icon: "/icons/google.svg",
    cls: "border border-zinc-300 bg-white text-slate-700 hover:bg-slate-50",
  },
];

const ERROR_MESSAGES: Record<string, string> = {
  not_configured:
    "이 소셜 로그인은 아직 준비 중입니다. 다른 방법으로 로그인해 주세요.",
  invalid_state: "보안 검증에 실패했습니다. 다시 시도해 주세요.",
  missing_code: "인가 코드를 받지 못했습니다. 다시 시도해 주세요.",
  access_denied: "로그인이 취소되었습니다.",
};

function PROVIDER_LABEL(p: string): string {
  if (p === "kakao") return "카카오";
  if (p === "naver") return "네이버";
  if (p === "google") return "Google";
  return p;
}

/**
 * 로그인/회원가입 페이지 공통 — 소셜 로그인 버튼 3개 + 구분선 + 에러 안내.
 * 클릭 시 백엔드 GET /auth/social/{provider}/login 으로 이동 → OAuth 인가 →
 * 콜백에서 토큰 발급 → /auth/social-callback 에서 tokenStorage 저장 → /mypage.
 */
export function SocialLoginButtons() {
  const searchParams = useSearchParams();
  const errKey = searchParams.get("social_error");
  const provider = searchParams.get("provider");
  const errorMsg = errKey
    ? `${provider ? PROVIDER_LABEL(provider) + " — " : ""}${
        ERROR_MESSAGES[errKey] ?? "소셜 로그인에 실패했습니다."
      }`
    : null;

  function go(p: Provider) {
    // 백엔드가 redirect 까지 모두 처리. 상대 경로 X — 절대 URL 사용.
    window.location.href = `${API_BASE_URL}/auth/social/${p}/login`;
  }

  return (
    <div className="space-y-4">
      {errorMsg ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </p>
      ) : null}

      <div className="space-y-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => go(p.key)}
            className={`flex w-full items-center justify-center gap-3 rounded-xl py-3 text-sm font-bold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${p.cls}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.icon} alt="" className="h-5 w-5" />
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs font-medium text-slate-400">
          또는 이메일로 계속
        </span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>
    </div>
  );
}
