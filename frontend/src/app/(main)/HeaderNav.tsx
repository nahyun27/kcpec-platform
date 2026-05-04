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

  return (
    <nav className="flex items-center gap-4 text-sm font-medium text-zinc-700">
      <Link href="/courses" className="hover:text-[var(--color-primary)]">
        강의 목록
      </Link>
      {authed ? (
        <>
          <Link href="/mypage" className="hover:text-[var(--color-primary)]">
            마이페이지
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded border border-[var(--color-border)] px-4 py-1.5 text-zinc-700 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            로그아웃
          </button>
        </>
      ) : (
        <>
          <Link href="/login" className="hover:text-[var(--color-primary)]">
            로그인
          </Link>
          <Link
            href="/signup"
            className="rounded bg-[var(--color-primary)] px-4 py-1.5 text-white hover:bg-[var(--color-primary-hover)]"
          >
            회원가입
          </Link>
        </>
      )}
    </nav>
  );
}
