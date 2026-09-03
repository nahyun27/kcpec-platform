"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, ChevronRight } from "lucide-react";
import { logout, tokenStorage } from "@/lib/api";

const NAV = [
  { href: "/sentencing", label: "맞춤 강의 찾기" },
  { href: "/counseling", label: "전문가 심리상담" },
  { href: "/courses", label: "강의 전체보기" },
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
    <header className="sticky top-0 md:top-4 z-50 transition-all px-0 md:px-6 pointer-events-none">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between bg-white/80 backdrop-blur-lg border-b border-zinc-200 md:border md:border-zinc-200/50 md:rounded-full md:shadow-lg md:shadow-slate-900/5 px-4 md:px-6 pointer-events-auto">
        {/* 좌: 로고 */}
        <div className="flex flex-1 items-center justify-start">
          {/* 모바일과 넓은 화면에서는 가로 로고, 애매한 중간 너비(md~lg)에서는 심볼 로고 */}
          <Logo className="md:hidden lg:flex" />
          <Logo kind="mark" className="hidden md:flex lg:hidden" />
        </div>

        {/* 중: 메뉴 */}
        <nav className="hidden flex-[2] items-center justify-center gap-8 text-[15px] font-bold text-slate-600 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="relative group py-2 whitespace-nowrap transition-colors hover:text-[var(--color-primary)]"
            >
              <span>{item.label}</span>
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2.5px] w-0 bg-[var(--color-primary)] transition-all duration-300 ease-out group-hover:w-full rounded-full opacity-0 group-hover:opacity-100" />
            </Link>
          ))}
        </nav>

        {/* 우: 인증 액션 및 모바일 메뉴 버튼 */}
        <div className="flex flex-1 items-center justify-end gap-3 text-sm font-semibold">
          <div className="hidden items-center gap-2 md:flex">
            {authed ? (
              <>
                <Link
                  href="/mypage"
                  className="rounded-full px-4 py-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  마이페이지
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2 text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-full px-4 py-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-gradient-to-r from-[var(--color-primary)] to-blue-700 px-6 py-2 text-white shadow-md shadow-blue-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-900/30"
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
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 md:hidden transition-colors"
            aria-label="메뉴 열기"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 모바일 메뉴 사이드 드로어 */}
      <div
        className={`fixed inset-0 z-[100] transition-all duration-300 md:hidden pointer-events-auto ${
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
          className={`absolute inset-y-0 right-0 flex w-[280px] sm:w-[320px] flex-col bg-white/95 backdrop-blur-xl shadow-2xl transition-transform duration-300 ease-out ${
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
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-[17px] font-bold text-zinc-900 transition-colors active:bg-zinc-100"
                >
                  <span>{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-zinc-300" />
                </Link>
              ))}
            </nav>

            <div className="mt-auto border-t border-zinc-100 pt-6 pb-8">
              <div className="grid grid-cols-1 gap-3">
                {authed ? (
                  <>
                    <Link
                      href="/mypage"
                      className="flex items-center justify-center rounded-xl bg-zinc-100 py-3 font-bold text-zinc-700"
                    >
                      마이페이지
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center justify-center rounded-xl bg-zinc-900 py-3 font-bold text-white shadow-lg"
                    >
                      로그아웃
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="flex items-center justify-center rounded-xl bg-zinc-100 py-3 font-bold text-zinc-700"
                    >
                      로그인
                    </Link>
                    <Link
                      href="/signup"
                      className="flex items-center justify-center rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-blue-600 py-3 font-bold text-white shadow-lg shadow-blue-900/20"
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
