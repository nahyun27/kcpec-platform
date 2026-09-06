"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { isAxiosError } from "axios";
import {
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileText,
  LayoutDashboard,
  MessageSquare,
  ShoppingCart,
  Users,
} from "lucide-react";
import { getMe, logout, tokenStorage } from "@/lib/api";

type SingleNav = {
  kind: "single";
  href: string;
  label: string;
  icon: ReactNode;
};

type GroupNav = {
  kind: "group";
  basePath: string;
  // 자식 메뉴를 구분하는 URL 쿼리 키 (예: "tab", "status"). 기본값 "tab".
  paramKey?: string;
  label: string;
  icon: ReactNode;
  children: { value: string; label: string }[];
};

const NAV: (SingleNav | GroupNav)[] = [
  { kind: "single", href: "/admin", label: "대시보드", icon: <LayoutDashboard className="h-4 w-4" /> },
  { kind: "single", href: "/admin/users", label: "사용자", icon: <Users className="h-4 w-4" /> },
  { kind: "single", href: "/admin/courses", label: "강의 관리", icon: <BookOpen className="h-4 w-4" /> },
  {
    kind: "group",
    basePath: "/admin/orders",
    paramKey: "status",
    label: "주문",
    icon: <ShoppingCart className="h-4 w-4" />,
    children: [
      { value: "all", label: "전체" },
      { value: "paid", label: "결제완료" },
      { value: "pending", label: "입금대기" },
      { value: "cancelled", label: "취소" },
      { value: "refunded", label: "환불" },
    ],
  },
  {
    kind: "group",
    basePath: "/admin/statistics",
    paramKey: "tab",
    label: "통계",
    icon: <BarChart2 className="h-4 w-4" />,
    children: [
      { value: "sales", label: "매출 통계" },
      { value: "visitors", label: "방문자 통계" },
    ],
  },
  { kind: "single", href: "/admin/documents", label: "의견서", icon: <FileText className="h-4 w-4" /> },
  {
    kind: "group",
    basePath: "/admin/community",
    paramKey: "tab",
    label: "커뮤니티",
    icon: <MessageSquare className="h-4 w-4" />,
    children: [
      { value: "notice", label: "공지사항" },
      { value: "resource", label: "자료실" },
      { value: "qna", label: "Q&A" },
      { value: "column", label: "전문가 칼럼" },
      { value: "review", label: "수강후기" },
      { value: "faq", label: "FAQ" },
    ],
  },
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
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col bg-slate-950 text-slate-300">
        <div className="shrink-0 border-b border-slate-800/60 px-6 py-6">
          <Logo variant="white" kind="mark" className="mb-2" />
          <p className="font-sans text-lg font-bold text-slate-100 tracking-tight">관리자 콘솔</p>
        </div>
        {/* nav 영역만 자체 스크롤 — 메뉴가 길어져도 사이드바 자체는 viewport 에 고정 */}
        <Suspense fallback={<nav className="flex-1 overflow-y-auto px-3 py-4" />}>
          <SidebarNav pathname={pathname} />
        </Suspense>
        <div className="shrink-0 space-y-3 border-t border-slate-800/60 px-4 py-5 text-xs">
          {username ? <p className="px-2 text-slate-500 font-medium">로그인: <span className="text-slate-300">{username}</span></p> : null}
          <button
            type="button"
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="w-full rounded-md border border-slate-800 bg-slate-900/50 py-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            로그아웃
          </button>
        </div>
      </aside>
      <main className="ml-60 min-h-screen min-w-0 overflow-x-hidden bg-slate-50">
        <div className="mx-auto min-w-0 max-w-[1400px] px-8 py-8">{children}</div>
      </main>
    </div>
  );
}

function SidebarNav({ pathname }: { pathname: string }) {
  const search = useSearchParams();
  // 그룹 별 펼침 상태. basePath 가 현재 경로와 일치하면 자동 열림 + 사용자 토글 가능.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of NAV) {
      if (item.kind === "group" && pathname.startsWith(item.basePath)) {
        initial[item.basePath] = true;
      }
    }
    return initial;
  });

  // 경로 변경으로 새 그룹에 진입하면 자동 펼침
  useEffect(() => {
    setOpenMap((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const item of NAV) {
        if (item.kind === "group" && pathname.startsWith(item.basePath) && !next[item.basePath]) {
          next[item.basePath] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pathname]);

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 text-sm">
      {NAV.map((item) => {
        if (item.kind === "single") {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 ${
                active
                  ? "bg-blue-600/10 font-semibold text-blue-400 relative after:absolute after:left-0 after:top-1/2 after:-translate-y-1/2 after:h-5 after:w-1 after:rounded-r-full after:bg-blue-500"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        }

        const groupActive = pathname.startsWith(item.basePath);
        const paramKey = item.paramKey ?? "tab";
        const activeValue = groupActive ? search.get(paramKey) : null;
        const open = openMap[item.basePath] ?? false;
        return (
          <div key={item.basePath}>
            <button
              type="button"
              onClick={() =>
                setOpenMap((m) => ({ ...m, [item.basePath]: !open }))
              }
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 ${
                groupActive
                  ? "bg-slate-900/50 font-medium text-slate-200"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {item.icon}
                {item.label}
              </span>
              {open ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {open ? (
              <div className="mt-1 space-y-0.5">
                {item.children.map((c) => {
                  const isActive = groupActive && activeValue === c.value;
                  return (
                    <Link
                      key={c.value}
                      href={`${item.basePath}?${paramKey}=${c.value}`}
                      className={`block py-2 pl-9 pr-3 text-[13px] transition-all duration-200 relative ${
                        isActive
                          ? "font-medium text-blue-400 before:absolute before:left-3.5 before:top-1/2 before:-translate-y-1/2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-blue-500"
                          : "text-slate-500 hover:text-slate-300 before:absolute before:left-[15px] before:top-1/2 before:-translate-y-1/2 before:h-1 before:w-1 before:rounded-full before:bg-slate-700 hover:before:bg-slate-500"
                      }`}
                    >
                      {c.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
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
