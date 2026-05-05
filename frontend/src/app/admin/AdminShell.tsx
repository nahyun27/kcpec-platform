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

type DenyReason =
  | { kind: "no_token" }
  | { kind: "not_admin"; username: string }
  | { kind: "unauthorized" }
  | { kind: "error"; message: string };

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authChecked, setAuthChecked] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [denied, setDenied] = useState<DenyReason | null>(null);

  useEffect(() => {
    if (!tokenStorage.getAccess()) {
      console.warn("[AdminShell] no access token in localStorage");
      setDenied({ kind: "no_token" });
      return;
    }
    getMe()
      .then((u) => {
        if (!u.is_admin) {
          console.warn(
            `[AdminShell] user '${u.username}' is_admin=false — bouncing to home. ` +
              "현재 토큰의 사용자가 관리자가 아닙니다. " +
              "관리자 계정으로 다시 로그인하거나 (backend/scripts/create_admin.py), " +
              "DB 에서 UPDATE users SET is_admin=true WHERE username='...'; 실행.",
          );
          setDenied({ kind: "not_admin", username: u.username });
          return;
        }
        setUsername(u.username);
        setAuthChecked(true);
      })
      .catch((err) => {
        if (isAxiosError(err) && err.response?.status === 401) {
          console.warn("[AdminShell] /auth/me 401 — token expired/invalid. clearing.");
          tokenStorage.clear();
          setDenied({ kind: "unauthorized" });
          return;
        }
        const msg = isAxiosError(err)
          ? `${err.response?.status ?? "?"} ${err.message}`
          : String(err);
        console.error("[AdminShell] /auth/me failed:", err);
        setDenied({ kind: "error", message: msg });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (denied) {
    return <DeniedScreen reason={denied} onLogout={() => { logout(); router.push("/login?next=/admin"); }} />;
  }
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

function DeniedScreen({
  reason,
  onLogout,
}: {
  reason: DenyReason;
  onLogout: () => void;
}) {
  const { title, body, action } = describe(reason);
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <p className="font-sans text-lg font-bold text-[var(--color-primary)]">{title}</p>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">
          {body}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {action === "login" ? (
            <Link
              href="/login?next=/admin"
              className="rounded bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
            >
              관리자로 로그인
            </Link>
          ) : null}
          {action === "switch" ? (
            <button
              type="button"
              onClick={onLogout}
              className="rounded bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
            >
              로그아웃하고 관리자로 다시 로그인
            </button>
          ) : null}
          <Link
            href="/"
            className="rounded border border-zinc-300 py-2.5 text-sm text-slate-700 hover:border-[var(--color-primary)]"
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}

function describe(r: DenyReason): {
  title: string;
  body: string;
  action: "login" | "switch" | null;
} {
  switch (r.kind) {
    case "no_token":
      return {
        title: "로그인이 필요합니다",
        body: "관리자 페이지는 로그인 후 접근 가능합니다.",
        action: "login",
      };
    case "not_admin":
      return {
        title: "관리자 권한이 없습니다",
        body:
          `현재 '${r.username}' 계정으로 로그인되어 있지만 관리자가 아닙니다.\n` +
          "관리자 계정 (admin) 으로 로그아웃 후 다시 로그인해 주세요.",
        action: "switch",
      };
    case "unauthorized":
      return {
        title: "세션이 만료되었습니다",
        body: "토큰이 만료되었거나 유효하지 않아 로그아웃 처리되었습니다.",
        action: "login",
      };
    case "error":
      return {
        title: "권한 확인 중 오류",
        body: `백엔드 통신에 실패했습니다: ${r.message}`,
        action: "login",
      };
  }
}
