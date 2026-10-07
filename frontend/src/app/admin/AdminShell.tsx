"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { isAxiosError } from "axios";
import {
  Activity,
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileText,
  LayoutDashboard,
  ScrollText,
  Menu,
  MessageSquare,
  Package,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import { getAdminStats, getMe, logout, tokenStorage } from "@/lib/api";
import type { AdminTodoCounts } from "@/types/admin";

// 대시보드 "오늘 할 일" 배너(app/admin/page.tsx TodoBanner)와 같은 항목을
// 가리키는 키 — 사이드바에서도 같은 카운트를 뱃지로 보여줘서, 대시보드가
// 아닌 다른 관리자 페이지에 있어도 할 일이 쌓였는지 알 수 있게 한다(2026-09).
type TodoKey = keyof AdminTodoCounts;

type SingleNav = {
  kind: "single";
  href: string;
  label: string;
  icon: ReactNode;
  todoKey?: TodoKey;
};

type GroupNav = {
  kind: "group";
  basePath: string;
  // 자식 메뉴를 구분하는 URL 쿼리 키 (예: "tab", "status"). 기본값 "tab".
  paramKey?: string;
  label: string;
  icon: ReactNode;
  children: { value: string; label: string; todoKey?: TodoKey }[];
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
  {
    kind: "single",
    href: "/admin/documents",
    label: "심리상담 의견서",
    icon: <FileText className="h-4 w-4" />,
    todoKey: "counseling_draft_review",
  },
  {
    kind: "single",
    href: "/admin/detention",
    label: "구속수용자 교육",
    icon: <Package className="h-4 w-4" />,
    todoKey: "detention_to_process",
  },
  {
    kind: "single",
    href: "/admin/legal-letters",
    label: "반성문·탄원서",
    icon: <ScrollText className="h-4 w-4" />,
    todoKey: "legal_letter_review",
  },
  {
    kind: "group",
    basePath: "/admin/community",
    paramKey: "tab",
    label: "커뮤니티",
    icon: <MessageSquare className="h-4 w-4" />,
    children: [
      { value: "notice", label: "공지사항" },
      { value: "resource", label: "자료실" },
      { value: "qna", label: "1:1 문의", todoKey: "unanswered_qna" },
      { value: "column", label: "전문가 칼럼" },
      { value: "review", label: "수강후기" },
      { value: "faq", label: "FAQ" },
    ],
  },
  { kind: "single", href: "/admin/health", label: "시스템 상태", icon: <Activity className="h-4 w-4" /> },
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [todo, setTodo] = useState<AdminTodoCounts | null>(null);

  // 페이지 이동 시 모바일 드로어 자동 닫힘 (SiteHeader 모바일 메뉴와 동일 패턴).
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

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

  // 사이드바 "할 일" 뱃지 — 대시보드(app/admin/page.tsx TodoBanner)를 안 보고
  // 다른 관리자 페이지에 머물러 있어도 새로 쌓인 할 일을 알 수 있도록, 인증
  // 확인 후 주기적으로 다시 불러온다(2026-09).
  useEffect(() => {
    if (!authChecked) return;
    let cancelled = false;
    const load = () => {
      getAdminStats()
        .then((s) => {
          if (!cancelled) setTodo(s.todo);
        })
        .catch(() => {
          /* 뱃지는 부가 정보라 실패해도 화면 전체를 막지 않는다 */
        });
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [authChecked]);

  if (denied) {
    return <DeniedScreen reason={denied} onLogout={() => { logout(); router.push("/login?next=/admin"); }} />;
  }
  if (!authChecked) {
    return <AuthCheckingScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 모바일 상단 바 — 데스크톱(md+)에서는 고정 사이드바만 쓰고 숨긴다. */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-slate-950 px-4 text-slate-200 md:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800"
          aria-label="메뉴 열기"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Logo variant="white" kind="mark" />
        <span className="font-sans text-sm font-bold text-slate-100">관리자 콘솔</span>
      </header>

      {/* 모바일 사이드바 드로어 — 데스크톱에서는 항상 보이는 고정 사이드바로 렌더. */}
      <div
        className={`fixed inset-0 z-40 md:hidden ${mobileNavOpen ? "visible" : "invisible"}`}
      >
        <div
          className={`absolute inset-0 bg-zinc-900/50 transition-opacity duration-200 ${
            mobileNavOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileNavOpen(false)}
        />
        <aside
          className={`absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-slate-950 text-slate-300 shadow-2xl transition-transform duration-200 ease-out ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-800/60 px-6 py-5">
            <div>
              <Logo variant="white" kind="mark" className="mb-2" />
              <p className="font-sans text-lg font-bold text-slate-100 tracking-tight">관리자 콘솔</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              aria-label="메뉴 닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <Suspense fallback={<nav className="flex-1 overflow-y-auto px-3 py-4" />}>
            <SidebarNav pathname={pathname} todo={todo} onNavigate={() => setMobileNavOpen(false)} />
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
      </div>

      {/* 데스크톱 고정 사이드바 */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-60 flex-col bg-slate-950 text-slate-300 md:flex">
        <div className="shrink-0 border-b border-slate-800/60 px-6 py-6">
          <Logo variant="white" kind="mark" className="mb-2" />
          <p className="font-sans text-lg font-bold text-slate-100 tracking-tight">관리자 콘솔</p>
        </div>
        {/* nav 영역만 자체 스크롤 — 메뉴가 길어져도 사이드바 자체는 viewport 에 고정 */}
        <Suspense fallback={<nav className="flex-1 overflow-y-auto px-3 py-4" />}>
          <SidebarNav pathname={pathname} todo={todo} />
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
      <main className="min-h-screen min-w-0 bg-slate-50 md:ml-60">
        <div className="mx-auto min-w-0 max-w-[1400px] px-4 py-6 sm:px-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}

// 사이드바 뱃지 — 숫자가 있으면 빨간 알약, 카운트를 알기 전(null)이거나
// 0이면 아무것도 안 그린다.
function TodoBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SidebarNav({
  pathname,
  todo,
  onNavigate,
}: {
  pathname: string;
  todo: AdminTodoCounts | null;
  onNavigate?: () => void;
}) {
  const search = useSearchParams();
  const count = (key: TodoKey | undefined) => (key && todo ? todo[key] ?? 0 : 0);
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
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 ${
                active
                  ? "bg-blue-600/10 font-semibold text-blue-400 relative after:absolute after:left-0 after:top-1/2 after:-translate-y-1/2 after:h-5 after:w-1 after:rounded-r-full after:bg-blue-500"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              {item.icon}
              {item.label}
              <TodoBadge count={count(item.todoKey)} />
            </Link>
          );
        }

        const groupActive = pathname.startsWith(item.basePath);
        const paramKey = item.paramKey ?? "tab";
        const activeValue = groupActive ? search.get(paramKey) : null;
        const open = openMap[item.basePath] ?? false;
        // 그룹이 접혀 있어도 할 일이 있다는 걸 알 수 있도록, 자식 중 하나라도
        // 카운트가 있으면 그룹 헤더에도 작은 점을 띄운다(펼치면 자식 뱃지로
        // 정확한 숫자를 볼 수 있음).
        const groupHasTodo = item.children.some((c) => count(c.todoKey) > 0);
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
                {groupHasTodo ? (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                ) : null}
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
                      onClick={onNavigate}
                      className={`flex items-center py-2 pl-9 pr-3 text-[13px] transition-all duration-200 relative ${
                        isActive
                          ? "font-medium text-blue-400 before:absolute before:left-3.5 before:top-1/2 before:-translate-y-1/2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-blue-500"
                          : "text-slate-500 hover:text-slate-300 before:absolute before:left-[15px] before:top-1/2 before:-translate-y-1/2 before:h-1 before:w-1 before:rounded-full before:bg-slate-700 hover:before:bg-slate-500"
                      }`}
                    >
                      {c.label}
                      <TodoBadge count={count(c.todoKey)} />
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

function AuthCheckingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-7 bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 px-6">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-[var(--color-primary)]/15" />
        <span className="absolute inset-0 rounded-full border-[3px] border-slate-200" />
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[var(--color-primary)] border-r-[var(--color-primary)]/40" />
        <Logo variant="default" kind="mark" className="pointer-events-none" imgClassName="h-11 w-11" />
      </div>
      <div className="text-center">
        <p className="font-sans text-base font-bold text-[var(--color-primary)]">
          관리자 페이지 불러오는 중
        </p>
        <p className="mt-1.5 text-sm text-slate-500">권한을 확인하고 있어요. 잠시만 기다려 주세요.</p>
      </div>
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
