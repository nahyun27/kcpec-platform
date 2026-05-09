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
  label: string;
  icon: ReactNode;
  children: { tab: string; label: string }[];
};

const NAV: (SingleNav | GroupNav)[] = [
  { kind: "single", href: "/admin", label: "대시보드", icon: <LayoutDashboard className="h-4 w-4" /> },
  { kind: "single", href: "/admin/users", label: "사용자", icon: <Users className="h-4 w-4" /> },
  { kind: "single", href: "/admin/courses", label: "강의 관리", icon: <BookOpen className="h-4 w-4" /> },
  { kind: "single", href: "/admin/orders", label: "주문", icon: <ShoppingCart className="h-4 w-4" /> },
  { kind: "single", href: "/admin/statistics", label: "매출 통계", icon: <BarChart2 className="h-4 w-4" /> },
  { kind: "single", href: "/admin/documents", label: "의견서", icon: <FileText className="h-4 w-4" /> },
  {
    kind: "group",
    basePath: "/admin/community",
    label: "커뮤니티",
    icon: <MessageSquare className="h-4 w-4" />,
    children: [
      { tab: "notice", label: "공지/자료실" },
      { tab: "qna", label: "Q&A" },
      { tab: "column", label: "전문가 칼럼" },
      { tab: "review", label: "수강후기" },
      { tab: "faq", label: "FAQ" },
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
    <div className="min-h-screen bg-zinc-100">
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col bg-[var(--color-primary)] text-white">
        <div className="shrink-0 border-b border-white/10 px-6 py-5">
          <Logo variant="white" kind="mark" className="mb-2" />
          <p className="font-sans text-lg font-bold">관리자 콘솔</p>
        </div>
        {/* nav 영역만 자체 스크롤 — 메뉴가 길어져도 사이드바 자체는 viewport 에 고정 */}
        <Suspense fallback={<nav className="flex-1 overflow-y-auto px-3 py-4" />}>
          <SidebarNav pathname={pathname} />
        </Suspense>
        <div className="shrink-0 space-y-2 border-t border-white/10 px-4 py-4 text-xs">
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
      <main className="ml-60 min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}

function SidebarNav({ pathname }: { pathname: string }) {
  const search = useSearchParams();
  const activeTab = search.get("tab");
  // 커뮤니티 경로면 아코디언 자동 열림 + 사용자 토글 가능
  const communityActive = pathname.startsWith("/admin/community");
  const [communityOpen, setCommunityOpen] = useState(communityActive);
  useEffect(() => {
    if (communityActive) setCommunityOpen(true);
  }, [communityActive]);

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
              className={`flex items-center gap-2 rounded px-3 py-2 transition-colors ${
                active
                  ? "bg-white/10 font-semibold text-white"
                  : "text-white/80 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        }

        // group (community)
        const open = communityOpen;
        return (
          <div key={item.basePath}>
            <button
              type="button"
              onClick={() => setCommunityOpen((v) => !v)}
              className={`flex w-full items-center justify-between gap-2 rounded px-3 py-2 transition-colors ${
                communityActive
                  ? "bg-white/10 font-semibold text-white"
                  : "text-white/80 hover:bg-white/5 hover:text-white"
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
                  const isActive = communityActive && activeTab === c.tab;
                  return (
                    <Link
                      key={c.tab}
                      href={`${item.basePath}?tab=${c.tab}`}
                      className={`block py-1.5 pl-8 pr-3 text-sm transition-colors ${
                        isActive
                          ? "border-l-2 border-white text-white"
                          : "border-l-2 border-transparent text-white/60 hover:text-white"
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
