"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { logout, tokenStorage } from "@/lib/api";

const NAV = [
  { href: "/courses", label: "강의 목록" },
  { href: "/counseling", label: "전문가 심리상담" },
  { href: "/community", label: "커뮤니티" },
  { href: "/guide", label: "이용 안내" },
  { href: "/faq", label: "자주 묻는 질문" },
];

/**
 * 사이트 전역 헤더. 홈(/) 과 (main)/layout.tsx 모두 이 컴포넌트를 사용한다.
 *
 * 레이아웃: 좌(로고) / 중(메뉴) / 우(인증 액션) 3분할.
 * - 메뉴는 `flex-1` 의 가운데 영역에서 항상 중앙 정렬.
 * - 좌·우는 `flex-1 + justify-{start|end}` 로 메뉴 정렬을 흔들지 않게 한다.
 * - 스크롤 시 backdrop-blur 로 투명도 + 흐림 효과 (sticky 헤더).
 */
export default function SiteHeader() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(Boolean(tokenStorage.getAccess()));
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "kcpec_access_token") {
        setAuthed(Boolean(tokenStorage.getAccess()));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function handleLogout() {
    logout();
    setAuthed(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-6">
        {/* 좌: 로고 */}
        <div className="flex flex-1 items-center justify-start">
          <Link href="/" className="flex items-center gap-2">
            {/* Logo Mark */}
            <div className="flex h-[36px] w-[56px] flex-col justify-between pt-0.5">
              <div className="h-[9px] w-full rounded-tl-[10px] rounded-tr-[1px] rounded-bl-[1px] rounded-br-[1px] bg-[#173874]"></div>
              <div className="flex flex-1 items-center justify-center">
                <span className="font-sans text-[15px] font-black leading-none tracking-wider text-[#173874]">
                  KCPEC
                </span>
              </div>
              <div className="h-[9px] w-full rounded-br-[10px] rounded-bl-[1px] rounded-tl-[1px] rounded-tr-[1px] bg-[#173874]"></div>
            </div>

            {/* Text Mark */}
            <div className="flex flex-col justify-center gap-0.5">
              <span className="font-sans text-[19px] font-black leading-none tracking-[-0.04em] text-slate-900">
                한국범죄예방교육센터
              </span>
              <span className="font-sans text-[8px] font-bold leading-none tracking-[0.03em] text-slate-400">
                KOREA CRIME PREVENTION EDUCATION CENTER
              </span>
            </div>
          </Link>
        </div>

        {/* 중: 메뉴 */}
        <nav className="hidden flex-1 items-center justify-center gap-8 text-sm font-medium text-zinc-700 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="relative group whitespace-nowrap transition-colors hover:text-[var(--color-primary)]"
            >
              <span>{item.label}</span>
              <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-[var(--color-accent)] transition-all group-hover:w-full" />
            </Link>
          ))}
        </nav>

        {/* 우: 인증 액션 */}
        <div className="flex flex-1 items-center justify-end gap-3 text-sm font-medium">
          {authed ? (
            <>
              <Link
                href="/mypage"
                className="px-2 py-1.5 text-zinc-600 transition-colors hover:text-zinc-900"
              >
                마이페이지
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-zinc-600 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-2 py-1.5 text-zinc-600 transition-colors hover:text-zinc-900"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-[var(--color-primary)] px-5 py-2 text-white shadow-md shadow-slate-900/10 transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] hover:shadow-lg"
              >
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
