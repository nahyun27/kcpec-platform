"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { logout, tokenStorage } from "@/lib/api";

export default function HeaderNav() {
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

  const navLink = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      className="relative group hover:text-[var(--color-primary)] transition-colors"
    >
      <span>{label}</span>
      <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-[var(--color-accent)] transition-all group-hover:w-full"></span>
    </Link>
  );

  return (
    <nav className="flex items-center gap-6 text-sm font-medium text-zinc-700">
      <div className="hidden items-center gap-6 md:flex">
        {navLink("/courses", "강의 목록")}
        {navLink("/community", "커뮤니티")}
        {navLink("/guide", "이용 안내")}
        {navLink("/faq", "자주 묻는 질문")}
      </div>
      {authed ? (
        <div className="flex items-center gap-3">
          <Link href="/mypage" className="relative group hover:text-[var(--color-primary)] transition-colors">
            <span>마이페이지</span>
            <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-[var(--color-accent)] transition-all group-hover:w-full"></span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-zinc-600 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
          >
            로그아웃
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Link href="/login" className="px-2 py-1.5 text-zinc-600 transition-colors hover:text-zinc-900">
            로그인
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-[var(--color-primary)] px-5 py-2 text-white shadow-md shadow-slate-900/10 transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] hover:shadow-lg"
          >
            회원가입
          </Link>
        </div>
      )}
    </nav>
  );
}
