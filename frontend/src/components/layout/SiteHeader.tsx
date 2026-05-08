"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, ChevronRight } from "lucide-react";
import { logout, tokenStorage } from "@/lib/api";

const NAV = [
  { href: "/courses", label: "강의 목록" },
  { href: "/counseling", label: "전문가 심리상담" },
  { href: "/community", label: "커뮤니티" },
  { href: "/guide", label: "이용 안내" },
];

export default function SiteHeader() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  // 페이지 이동 시 메뉴 닫기
  useEffect(() => {
    setIsMenuOpen(false);
  }, [router]);

  function handleLogout() {
    logout();
    setAuthed(false);
    router.push("/");
    router.refresh();
    setIsMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-6">
        {/* 좌: 로고 */}
        <div className="flex flex-1 items-center justify-start">
          <Logo />
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

        {/* 우: 인증 액션 및 모바일 메뉴 버튼 */}
        <div className="flex flex-1 items-center justify-end gap-3 text-sm font-medium">
          <div className="hidden items-center gap-3 md:flex">
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

          {/* 모바일 햄버거 버튼 */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 md:hidden"
            aria-label="메뉴 열기"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* 모바일 메뉴 사이드 드로어 */}
      <div
        className={`fixed inset-0 z-[100] transition-all duration-300 md:hidden ${
          isMenuOpen ? "visible" : "invisible"
        }`}
      >
        {/* 뒷배경 오버레이 */}
        <div
          className={`absolute inset-0 bg-zinc-900/40 backdrop-blur-sm transition-opacity duration-300 ${
            isMenuOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setIsMenuOpen(false)}
        />

        {/* 사이드 드로어 본체 */}
        <div
          className={`absolute inset-y-0 right-0 flex w-[280px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
            isMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5">
            <Logo className="scale-90" />
            <button
              type="button"
              onClick={() => setIsMenuOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
            <nav className="space-y-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-xl px-4 py-4 text-[17px] font-bold text-zinc-900 transition-colors active:bg-zinc-100"
                >
                  <span>{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-zinc-300" />
                </Link>
              ))}
            </nav>

            <div className="mt-auto border-t border-zinc-100 pt-6 pb-10">
              <div className="grid grid-cols-1 gap-3">
                {authed ? (
                  <>
                    <Link
                      href="/mypage"
                      className="flex items-center justify-center rounded-xl bg-zinc-100 py-4 font-bold text-zinc-700"
                    >
                      마이페이지
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center justify-center rounded-xl bg-zinc-900 py-4 font-bold text-white shadow-lg"
                    >
                      로그아웃
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="flex items-center justify-center rounded-xl bg-zinc-100 py-4 font-bold text-zinc-700"
                    >
                      로그인
                    </Link>
                    <Link
                      href="/signup"
                      className="flex items-center justify-center rounded-xl bg-[var(--color-primary)] py-4 font-bold text-white shadow-lg shadow-blue-900/20"
                    >
                      회원가입
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
