"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { getMe, logout, tokenStorage } from "@/lib/api";

const NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/users", label: "사용자" },
  { href: "/admin/courses", label: "강의 관리" },
  { href: "/admin/orders", label: "주문" },
  { href: "/admin/surveys", label: "의견서" },
  { href: "/admin/community", label: "커뮤니티" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authChecked, setAuthChecked] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenStorage.getAccess()) {
      router.replace("/");
      return;
    }
    getMe()
      .then((u) => {
        if (!u.is_admin) {
          router.replace("/");
          return;
        }
        setUsername(u.username);
        setAuthChecked(true);
      })
      .catch((err) => {
        if (isAxiosError(err) && err.response?.status === 401) {
          tokenStorage.clear();
        }
        router.replace("/");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-sm text-zinc-500">
        관리자 권한 확인 중...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-100">
      <aside className="flex w-60 flex-col bg-[var(--color-primary)] text-white">
        <div className="border-b border-white/10 px-6 py-5">
          <p className="text-xs uppercase tracking-widest text-white/60">KCPEC</p>
          <p className="font-sans text-lg font-bold">관리자 콘솔</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4 text-sm">
          {NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded px-3 py-2 transition-colors ${
                  active
                    ? "bg-white/10 font-semibold text-white"
                    : "text-white/80 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-white/10 px-4 py-4 text-xs">
          {username ? <p className="text-white/70">로그인: {username}</p> : null}
          <button
            type="button"
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="w-full rounded border border-white/20 py-1.5 text-white/80 hover:bg-white/10"
          >
            로그아웃
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden bg-white">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
