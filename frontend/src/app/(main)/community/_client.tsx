"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getFaqs,
  getNotices,
  getPosts,
  getReviewSummary,
  getReviews,
  tokenStorage,
} from "@/lib/api";
import type {
  Faq,
  NoticeListItem,
  PostListItem,
  ReviewCourseStat,
  ReviewItem,
  ReviewSummary,
} from "@/types/community";
import { counselingDisplayTitle } from "@/types/counseling";
import { Stars } from "@/components/reviews/Stars";
import { formatAverage } from "@/components/reviews/reviewSummary";
import {
  ChevronDown,
  Pin,
  MessageSquare,
  FileText,
  Edit3,
  Loader2,
  AlertCircle,
  Inbox,
  Download,
  Star,
  HelpCircle,
  X,
  Megaphone,
  FileDown,
  ArrowRight,
  Search,
  Phone,
} from "lucide-react";
import { createPortal } from "react-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReviewWriteForm } from "@/components/features/ReviewWriteForm";

type TabKey = "notice" | "column" | "review" | "faq";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "notice", label: "공지사항 및 자료실", icon: <Pin className="w-4 h-4" /> },
  { key: "column", label: "전문가 칼럼", icon: <FileText className="w-4 h-4" /> },
  { key: "review", label: "강의 수강 및 상담 후기", icon: <Star className="w-4 h-4" /> },
  { key: "faq", label: "자주 묻는 질문", icon: <HelpCircle className="w-4 h-4" /> },
];

function isTabKey(s: string | null): s is TabKey {
  return (
    s === "notice" ||
    s === "column" ||
    s === "review" ||
    s === "faq"
  );
}

export default function CommunityClient() {
  const router = useRouter();
  const search = useSearchParams();
  const tabParam = search.get("tab");
  const tab: TabKey = isTabKey(tabParam) ? tabParam : "notice";

  function setTab(next: TabKey) {
    const params = new URLSearchParams(search.toString());
    params.set("tab", next);
    router.replace(`/community?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="bg-white pt-10 md:pt-16 relative z-10 border-b border-slate-100">
        <div className="mx-auto max-w-5xl px-6">
          <PageHeader
            title="커뮤니티"
            subtitle="Community"
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            description="KCPEC 커뮤니티에서 유익한 자료를 확인하고, 다른 수강생들과 자유롭게 소통해보세요."
          />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-8 md:pt-12 pb-12 md:pb-24">

      {/* Segmented Control / Pill Navigation */}
      <div className="hide-scrollbar -mx-4 mb-8 overflow-x-auto px-4 pb-2 sm:mx-0 sm:mb-10 sm:px-0">
        <div className="inline-flex w-max gap-1 rounded-full bg-slate-100/80 p-1 shadow-inner sm:w-auto sm:gap-1.5 border border-slate-200/60">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 sm:gap-2 sm:px-6 sm:py-2.5 ${
                  active
                    ? "bg-white text-[var(--color-primary)] shadow-md ring-1 ring-black/5 scale-[1.02]"
                    : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
        {tab === "notice" ? <NoticeTab /> : null}
        {tab === "column" ? <ColumnTab /> : null}
        {tab === "review" ? <ReviewTab /> : null}
        {tab === "faq" ? <FaqTab /> : null}
      </div>
    </div>
    </div>
  );
}

// 본문이 HTML 이면 그대로, plain text 면 <p> 단락으로 감싼다.
// TipTap 에디터로 작성된 새 글은 HTML, 기존 plain text 시드/사용자 데이터는
// 자연스럽게 단락 분리해 동일 .tiptap-content 스타일을 입을 수 있게.
function richHtml(content: string | null | undefined): string {
  if (!content) return "";
  const trimmed = content.trim();
  if (trimmed.startsWith("<")) return trimmed;
  return trimmed
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

// ---------- shared accordion -----------------------------------------------

function AccordionRow({
  open,
  onToggle,
  header,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="overflow-hidden border-b border-slate-100 last:border-b-0 bg-white transition-all duration-300">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between px-4 sm:px-6 py-5 text-left transition-all duration-300 outline-none hover:bg-slate-50/50 ${
          open ? "bg-slate-50/30" : ""
        }`}
      >
        <div className="flex-1 overflow-hidden pr-4">{header}</div>
        <div className={`flex shrink-0 items-center justify-center h-8 w-8 rounded-full transition-transform duration-300 ${open ? 'rotate-180 bg-slate-100 text-slate-700' : 'text-slate-300 hover:bg-slate-50'}`}>
          <ChevronDown className="h-5 w-5" />
        </div>
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="bg-slate-50/50 px-4 sm:px-6 py-6 text-sm shadow-inner sm:text-base border-t border-slate-100/50">
            {children}
          </div>
        </div>
      </div>
    </li>
  );
}

// ---------- 공지사항 / 자료실 -------------------------------------------------

type NoticeFilter = "all" | "notice" | "resource";

function NoticeTab() {
  const [items, setItems] = useState<NoticeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [filter, setFilter] = useState<NoticeFilter>("all");

  useEffect(() => {
    let cancelled = false;
    getNotices(undefined, 1, 100)
      .then((r) => !cancelled && setItems(r.items))
      .catch(() => !cancelled && setError("목록을 불러오지 못했습니다."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage text={error} />;
  if (items.length === 0) return <EmptyMessage text="등록된 공지사항이나 자료가 없습니다." icon={<Pin className="h-10 w-10 text-slate-300" />} />;

  const counts = {
    all: items.length,
    notice: items.filter((n) => n.category === "notice").length,
    resource: items.filter((n) => n.category !== "notice").length,
  };
  const visible = items.filter((n) =>
    filter === "all" ? true : filter === "notice" ? n.category === "notice" : n.category !== "notice",
  );

  return (
    <div className="space-y-5">
      <FilterChips
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setOpenId(null);
        }}
        options={[
          { key: "all", label: "전체", count: counts.all },
          { key: "notice", label: "공지", count: counts.notice },
          { key: "resource", label: "자료실", count: counts.resource },
        ]}
      />
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <ul className="divide-y divide-slate-100">
          {visible.map((n) => (
            <NoticeAccordion
              key={n.id}
              notice={n}
              open={openId === n.id}
              onToggle={() => setOpenId(openId === n.id ? null : n.id)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function FilterChips<K extends string>({
  value,
  onChange,
  options,
}: {
  value: K;
  onChange: (k: K) => void;
  options: { key: K; label: string; count?: number }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
              active
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
            }`}
          >
            {o.label}
            {o.count != null ? (
              <span className={`ml-1 ${active ? "text-white/60" : "text-slate-400"}`}>{o.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function NoticeAccordion({
  notice,
  open,
  onToggle,
}: {
  notice: NoticeListItem;
  open: boolean;
  onToggle: () => void;
}) {
  const [detail, setDetail] = useState<{
    content: string;
    file_url: string | null;
  } | null>(null);

  useEffect(() => {
    if (!open || detail) return;
    let cancelled = false;
    import("@/lib/api").then(({ getNotice }) =>
      getNotice(notice.id)
        .then((d) => {
          if (!cancelled) setDetail({ content: d.content, file_url: d.file_url });
        })
        .catch(() => {
          /* ignore */
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [open, notice.id, detail]);

  const isNotice = notice.category === "notice";

  return (
    <AccordionRow
      open={open}
      onToggle={onToggle}
      header={
        <div className="flex items-center gap-4">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              isNotice ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-[var(--color-accent)]"
            }`}
          >
            {isNotice ? <Megaphone className="h-5 w-5" /> : <FileDown className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {notice.is_pinned ? (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-bold text-rose-600">
                  <Pin className="h-3 w-3" /> 고정
                </span>
              ) : null}
              <span className="text-[11px] font-bold text-slate-400">{isNotice ? "공지" : "자료실"}</span>
            </div>
            <p className="mt-1 line-clamp-2 break-words text-[15px] font-bold leading-snug text-slate-800 sm:text-base">
              {notice.title}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {new Date(notice.created_at).toLocaleDateString("ko-KR")} · 조회 {notice.view_count.toLocaleString()}
            </p>
          </div>
        </div>
      }
    >
      {detail ? (
        <div className="space-y-6">
          <div
            className="tiptap-content text-slate-700 text-[15px]"
            dangerouslySetInnerHTML={{ __html: richHtml(detail.content) }}
          />
          {detail.file_url && (
            <a
              href={detail.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--color-primary-hover)]"
            >
              <Download className="h-4 w-4" />
              첨부파일 다운로드
            </a>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-slate-400 py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>본문을 불러오는 중입니다...</span>
        </div>
      )}
    </AccordionRow>
  );
}

// ---------- 전문가 칼럼 ------------------------------------------------------

function ColumnTab() {
  const [items, setItems] = useState<PostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState<PostListItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPosts("column", 1, 100)
      .then((r) => !cancelled && setItems(r.items))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Loading />;
  if (items.length === 0) return <EmptyMessage text="등록된 칼럼이 없습니다." icon={<FileText className="h-10 w-10 text-slate-300" />} />;

  const [latest, ...rest] = items;
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setReading(latest)}
          className="group relative overflow-hidden rounded-3xl bg-[#1C3461] p-6 text-left text-white shadow-md transition-transform hover:-translate-y-0.5 md:col-span-2 md:p-9"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-blue-100">
            <FileText className="h-3.5 w-3.5" /> 최신 칼럼
          </span>
          <p className="relative mt-4 text-xl font-extrabold leading-snug md:text-2xl">{latest.title}</p>
          <p className="relative mt-3 text-sm text-blue-100/80">
            {new Date(latest.created_at).toLocaleDateString("ko-KR")} · 조회 {latest.view_count.toLocaleString()}
          </p>
          <span className="relative mt-6 inline-flex items-center gap-1 text-sm font-bold text-white">
            읽어보기 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </button>
        {rest.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setReading(p)}
            className="group flex flex-col justify-between gap-5 rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
          >
            <p className="text-base font-bold leading-snug text-slate-900 md:text-[17px]">{p.title}</p>
            <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
              <span>
                {new Date(p.created_at).toLocaleDateString("ko-KR")} · 조회 {p.view_count.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-slate-600 group-hover:text-[var(--color-accent)]">
                읽기 <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </button>
        ))}
      </div>
      {reading ? <ColumnReader post={reading} onClose={() => setReading(null)} /> : null}
    </>
  );
}

// 칼럼 읽기 창 — 목록 안에서 500px 스크롤 상자로 읽던 것을 넓은 창으로.
function ColumnReader({ post, onClose }: { post: PostListItem; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@/lib/api").then(({ getPost }) =>
      getPost(post.id)
        .then((d) => !cancelled && setContent(d.content))
        .catch(() => !cancelled && setContent("")),
    );
    return () => {
      cancelled = true;
    };
  }, [post.id]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 md:items-center md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={post.title}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-in slide-in-from-bottom-8 duration-300 md:max-w-2xl md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-slate-100 px-6 pb-5 pt-6 md:px-9 md:pt-8">
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
          <p className="text-xs font-bold text-[var(--color-accent)]">전문가 칼럼</p>
          <h2 className="mt-2 pr-8 text-xl font-extrabold leading-snug text-slate-900 md:text-2xl">{post.title}</h2>
          <p className="mt-2 text-xs text-slate-400">
            {post.author_name} · {new Date(post.created_at).toLocaleDateString("ko-KR")}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-9 md:py-8">
          {content === null ? (
            <div className="flex items-center gap-2 py-8 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> 본문을 불러오는 중입니다...
            </div>
          ) : (
            <div
              className="tiptap-content text-[15px] leading-relaxed text-slate-700"
              dangerouslySetInnerHTML={{ __html: richHtml(content) }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------- 후기 (평점 요약 + 분야·강의 필터) --------------------------------

const CATEGORY_BADGE: Record<string, string> = {
  성범죄: "bg-purple-50 text-purple-700 ring-purple-500/20",
  폭력: "bg-emerald-50 text-emerald-700 ring-emerald-500/20",
  재산범죄: "bg-stone-50 text-stone-700 ring-stone-500/20",
  "약물·도박": "bg-amber-50 text-amber-700 ring-amber-500/20",
  교통: "bg-rose-50 text-rose-700 ring-rose-500/20",
  준법의식: "bg-slate-100 text-slate-700 ring-slate-500/20",
  심리상담: "bg-sky-50 text-sky-700 ring-sky-500/20",
};

function badgeClassFor(category: string | null): string {
  return (category && CATEGORY_BADGE[category]) || "bg-zinc-100 text-zinc-700 ring-zinc-500/20";
}

// 서버 /reviews 의 category 는 강의 분야 값만 받는다("기타" 등은 필터 칩에서 뺌).
const FILTERABLE_CATEGORIES = new Set(Object.keys(CATEGORY_BADGE));

function reviewCourseLabel(title: string | null, category: string | null): string | null {
  if (category === "심리상담") return counselingDisplayTitle(title);
  return title;
}

const REVIEW_PAGE_SIZE = 20;
const COURSE_STATS_PREVIEW = 6;
const COURSE_STATS_PREVIEW_MOBILE = 3;

function ReviewTab() {
  const router = useRouter();
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [course, setCourse] = useState<ReviewCourseStat | null>(null);
  const [showAllCourses, setShowAllCourses] = useState(false);
  const [writing, setWriting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    getReviewSummary().then(setSummary).catch(() => {});
  }, [reloadKey]);

  useEffect(() => {
    let alive = true;
    getReviews({ category, course_id: course?.course_id, page: 1, size: REVIEW_PAGE_SIZE })
      .then((r) => {
        if (!alive) return;
        setItems(r.items);
        setTotal(r.total);
        setPage(1);
      })
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [category, course, reloadKey]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = page + 1;
      const r = await getReviews({ category, course_id: course?.course_id, page: next, size: REVIEW_PAGE_SIZE });
      setItems((prev) => [...(prev ?? []), ...r.items]);
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  }

  function pickCategory(next: string | null) {
    setCourse(null);
    if (next === category) return;
    setItems(null);
    setCategory(next);
  }

  function pickCourse(next: ReviewCourseStat) {
    setItems(null);
    setCategory(null);
    setCourse((cur) => (cur?.course_id === next.course_id ? null : next));
  }

  function handleWriteToggle() {
    if (!tokenStorage.getAccess()) {
      router.push("/login?next=/community?tab=review");
      return;
    }
    setWriting((w) => !w);
  }

  const courseStats = useMemo(
    () => (summary ? [...summary.courses].sort((a, b) => b.count - a.count || b.average - a.average) : []),
    [summary],
  );
  const shownCourses = showAllCourses ? courseStats : courseStats.slice(0, COURSE_STATS_PREVIEW);
  const chips = summary
    ? [{ key: null as string | null, label: "전체", count: summary.count }].concat(
        summary.categories
          .filter((c) => FILTERABLE_CATEGORIES.has(c.key))
          .map((c) => ({ key: c.key, label: c.key, count: c.count })),
      )
    : [];

  return (
    <div className="space-y-6">
      {summary && summary.count > 0 ? (
        <section className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:p-8">
          <div className="flex items-center gap-6 md:flex-col md:items-start md:justify-center md:gap-4 md:border-r md:border-slate-100 md:pr-8">
            <div className="shrink-0">
              <p className="text-xs font-bold text-slate-500">전체 평점</p>
              <p className="mt-1 font-sans text-5xl font-black leading-none text-slate-900">
                {formatAverage(summary.average)}
              </p>
              <div className="mt-2.5">
                <Stars value={summary.average} className="h-5 w-5" />
              </div>
              <p className="mt-1.5 text-sm text-slate-500">
                후기 <b className="text-slate-700">{summary.count.toLocaleString()}</b>개
              </p>
            </div>
            <ul className="w-full min-w-0 flex-1 space-y-1.5">
              {["5", "4", "3", "2", "1"].map((k) => {
                const n = summary.distribution[k] ?? 0;
                return (
                  <li key={k} className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="w-6 shrink-0">{k}점</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full bg-amber-400"
                        style={{ width: `${(n / Math.max(1, summary.count)) * 100}%` }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right tabular-nums">{n}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800">강의별 평점</p>
            <p className="mt-0.5 text-xs text-slate-400">강의를 누르면 그 강의 후기만 볼 수 있어요.</p>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {shownCourses.map((c, i) => {
                const active = course?.course_id === c.course_id;
                // 모바일은 세로로 길어져서 접힌 상태에선 3개만.
                const mobileHidden = !showAllCourses && i >= COURSE_STATS_PREVIEW_MOBILE;
                return (
                  <li key={c.course_id} className={mobileHidden ? "hidden sm:block" : undefined}>
                    <button
                      type="button"
                      onClick={() => pickCourse(c)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                        active
                          ? "border-[var(--color-primary)] bg-blue-50/60"
                          : "border-slate-100 bg-slate-50/60 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-slate-800">
                          {reviewCourseLabel(c.course_title, c.category)}
                        </span>
                        <span className="text-[11px] text-slate-400">{c.category}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="text-sm font-extrabold tabular-nums text-slate-900">
                          {formatAverage(c.average)}
                        </span>
                        <span className="text-xs tabular-nums text-slate-400">({c.count})</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {courseStats.length > COURSE_STATS_PREVIEW_MOBILE ? (
              <button
                type="button"
                onClick={() => setShowAllCourses((v) => !v)}
                className={`mt-2 items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 ${
                  courseStats.length > COURSE_STATS_PREVIEW || showAllCourses ? "inline-flex" : "inline-flex sm:hidden"
                }`}
              >
                {showAllCourses ? "접기" : `강의 ${courseStats.length}개 모두 보기`}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllCourses ? "rotate-180" : ""}`} />
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:pb-0">
          {chips.map((chip) => {
            const active = course == null && chip.key === category;
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() => pickCategory(chip.key)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                {chip.label} <span className={active ? "text-white/60" : "text-slate-400"}>{chip.count}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={handleWriteToggle}
          className={`shrink-0 inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold transition-all ${
            writing
              ? "bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              : "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20 hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] hover:shadow-lg"
          }`}
        >
          {writing ? "취소하기" : <><Edit3 className="h-4 w-4" /> 후기 작성</>}
        </button>
      </div>

      {course ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-blue-50/70 px-4 py-3 text-sm">
          <span className="min-w-0 text-slate-700">
            <b className="text-slate-900">{reviewCourseLabel(course.course_title, course.category)}</b> 후기만 보는 중
          </span>
          <button
            type="button"
            onClick={() => {
              setItems(null);
              setCourse(null);
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm hover:text-slate-900"
          >
            <X className="h-3.5 w-3.5" /> 전체 보기
          </button>
        </div>
      ) : null}

      {writing && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <ReviewWriteForm
            onCancel={() => setWriting(false)}
            onCreated={async () => {
              setWriting(false);
              setReloadKey((k) => k + 1);
            }}
          />
        </div>
      )}

      {items == null ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyMessage text="아직 등록된 후기가 없습니다." icon={<Star className="h-10 w-10 text-slate-300" />} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((r) => (
            <ReviewListItem key={r.id} review={r} />
          ))}
        </ul>
      )}

      {items != null && items.length < total ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-full border border-zinc-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-60"
          >
            {loadingMore ? "불러오는 중..." : `후기 더보기 (${items.length}/${total})`}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ReviewListItem({ review }: { review: ReviewItem }) {
  // 별점만 남긴 후기(글 선택, 2026-10)는 본문이 비어 있다 — 서버가 맨 뒤로 보낸다.
  const body = (review.content ?? "").trim();
  // 목록에서는 4줄까지만 보이고, 긴 후기는 "더보기"로 전문을 펼친다.
  const [expanded, setExpanded] = useState(false);
  const title = reviewCourseLabel(review.course_title, review.category);
  return (
    <li className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[15px] font-bold leading-snug text-slate-900">
          {title ?? "수강 후기"}
        </p>
        {review.category ? (
          <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ring-1 ${badgeClassFor(review.category)}`}>
            {review.category}
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
        <Stars value={review.rating} className="h-3.5 w-3.5" />
        <span>익명 · {new Date(review.created_at).toLocaleDateString("ko-KR")}</span>
      </div>

      {body ? (
        <>
          <p
            className={`mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700 ${
              expanded ? "" : "line-clamp-4"
            }`}
          >
            {body}
          </p>
          {body.length > 120 ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 self-start text-[13px] font-bold text-[var(--color-primary)] hover:underline"
            >
              {expanded ? "접기" : "더보기"}
            </button>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-xs text-slate-400">별점만 남긴 후기예요.</p>
      )}
    </li>
  );
}

// ---------- 자주 묻는 질문 (정적 콘텐츠) -------------------------------------

type FaqCategory = "all" | "docs" | "refund" | "counseling" | "etc";

const FAQ_CATEGORY_TABS: { key: FaqCategory; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "docs", label: "수료증·서류" },
  { key: "refund", label: "환불·취소" },
  { key: "counseling", label: "상담" },
  { key: "etc", label: "기타" },
];

function FaqTab() {
  const [cat, setCat] = useState<FaqCategory>("all");
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [faqs, setFaqs] = useState<Faq[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFaqs()
      .then(setFaqs)
      .catch(() => setError("자주 묻는 질문을 불러오지 못했습니다."));
  }, []);

  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    if (faqs == null) return [];
    const q = query.replace(/\s+/g, "");
    return faqs.filter(
      (it) =>
        (cat === "all" || it.category === cat) &&
        (!q || `${it.question}${it.answer}`.replace(/\s+/g, "").includes(q)),
    );
  }, [faqs, cat, query]);

  if (error) {
    return (
      <EmptyMessage text={error} icon={<AlertCircle className="h-10 w-10 text-red-300" />} />
    );
  }
  if (faqs == null) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <label className="flex h-12 items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/15">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpenIdx(null);
          }}
          placeholder="궁금한 내용을 검색해 보세요 (예: 환불, 재발급)"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기" className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </label>
      <FilterChips
        value={cat}
        onChange={(k) => {
          setCat(k);
          setOpenIdx(0);
        }}
        options={FAQ_CATEGORY_TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count: t.key === "all" ? faqs.length : faqs.filter((f) => f.category === t.key).length,
        }))}
      />

      {visible.length === 0 ? (
        <EmptyMessage
          text={query ? "검색 결과가 없습니다." : "해당 카테고리의 질문이 아직 없습니다."}
          icon={<HelpCircle className="h-10 w-10 text-slate-300" />}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((item, idx) => {
            const open = openIdx === idx;
            return (
              <li
                key={item.id}
                className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 ${open ? "border-[var(--color-primary)]/20 ring-1 ring-[var(--color-primary)]/10" : "border-slate-200"}`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : idx)}
                  className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors ${open ? "bg-slate-50/50" : "hover:bg-slate-50/80"}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="font-bold text-[var(--color-primary)] mt-0.5">Q.</span>
                    <span className="font-sans text-[15px] font-bold text-slate-800 leading-snug">
                      {item.question}
                    </span>
                  </div>
                  <div className={`flex shrink-0 items-center justify-center h-8 w-8 rounded-full transition-transform duration-300 ${open ? 'rotate-180 bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'bg-slate-100 text-slate-400'}`}>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </button>
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                    open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="flex gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-5">
                      <span className="font-bold text-[var(--color-accent)]">A.</span>
                      <div className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                        {item.answer}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col items-start gap-4 rounded-3xl bg-slate-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between md:p-8">
        <div>
          <p className="text-lg font-extrabold">찾는 답이 없으신가요?</p>
          <p className="mt-1 text-sm text-slate-300">1:1 문의를 남기시거나 전화로 편하게 물어보세요.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link
            href="/mypage?tab=inquiry"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-white px-5 text-sm font-bold text-slate-900 hover:bg-slate-100"
          >
            <MessageSquare className="h-4 w-4" /> 1:1 문의하기
          </Link>
          <a
            href="tel:01063773325"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-white/25 px-5 text-sm font-bold text-white hover:bg-white/10"
          >
            <Phone className="h-4 w-4" /> 010-6377-3325
          </a>
        </div>
      </div>
    </div>
  );
}


// ---------- shared status panes ---------------------------------------------

function Loading() {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 py-12">
      <Loader2 className="h-10 w-10 animate-spin text-[var(--color-accent)]" />
      <p className="text-sm font-medium text-slate-500">데이터를 불러오는 중입니다...</p>
    </div>
  );
}

function ErrorMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 py-12 text-center shadow-sm">
      <AlertCircle className="mb-4 h-10 w-10 text-red-400" />
      <p className="text-base font-bold text-red-600">{text}</p>
      <p className="mt-1 text-sm text-red-500">잠시 후 다시 시도해 주세요.</p>
    </div>
  );
}

function EmptyMessage({ text, icon }: { text: string, icon?: React.ReactNode }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-slate-50/50 py-16 text-center shadow-sm transition-all hover:bg-slate-50">
      {icon || <Inbox className="mb-5 h-12 w-12 text-slate-300" />}
      <p className="text-base font-bold text-slate-600">{text}</p>
    </div>
  );
}
