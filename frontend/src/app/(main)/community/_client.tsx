"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import {
  createPost,
  getNotices,
  getPosts,
  tokenStorage,
} from "@/lib/api";
import {
  COMMUNITY_LABEL,
  type NoticeListItem,
  type PostListItem,
} from "@/types/community";
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
  HelpCircle
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

type TabKey = "notice" | "qna" | "column" | "review" | "faq";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "notice", label: "공지사항 및 자료실", icon: <Pin className="w-4 h-4" /> },
  { key: "qna", label: "Q&A", icon: <MessageSquare className="w-4 h-4" /> },
  { key: "column", label: "전문가 칼럼", icon: <FileText className="w-4 h-4" /> },
  { key: "review", label: "강의 수강 및 상담 후기", icon: <Star className="w-4 h-4" /> },
  { key: "faq", label: "자주 묻는 질문", icon: <HelpCircle className="w-4 h-4" /> },
];

function isTabKey(s: string | null): s is TabKey {
  return (
    s === "notice" ||
    s === "qna" ||
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
    <div className="mx-auto min-h-[80vh] max-w-5xl px-4 pb-24 pt-6 sm:px-6 sm:pt-12">
      <PageHeader
        title="커뮤니티"
        subtitle="Community"
        icon={<MessageSquare className="h-3.5 w-3.5" />}
        description="공지사항, Q&A, 전문가 칼럼, 수강 후기를 한 곳에서 편리하게 확인하세요."
      />

      {/* Pill Tabs — 모바일에선 가로 스크롤(절대 줄바꿈 X), 데스크톱에선 일반 배치 */}
      <div className="hide-scrollbar -mx-4 mb-6 overflow-x-auto px-4 pb-2 sm:mx-0 sm:mb-8 sm:px-0">
        <div className="inline-flex w-max gap-1.5 rounded-2xl bg-slate-100 p-1.5 sm:w-auto sm:gap-2">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-all duration-300 sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm ${
                  active
                    ? "bg-white text-[var(--color-primary)] shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
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
        {tab === "qna" ? <QnaTab /> : null}
        {tab === "column" ? <ColumnTab /> : null}
        {tab === "review" ? <ReviewTab /> : null}
        {tab === "faq" ? <FaqTab /> : null}
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
    <li className="overflow-hidden border-b border-slate-100 last:border-b-0 transition-colors duration-300 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between px-6 py-5 text-left transition-all duration-300 outline-none ${
          open ? "bg-slate-50/50" : "hover:bg-slate-50/80"
        }`}
      >
        <div className="flex-1 overflow-hidden pr-4">{header}</div>
        <div className={`flex shrink-0 items-center justify-center h-8 w-8 rounded-full transition-transform duration-300 ${open ? 'rotate-180 bg-slate-200 text-slate-700' : 'bg-slate-50 text-slate-400'}`}>
          <ChevronDown className="h-5 w-5" />
        </div>
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-slate-100 bg-slate-50/30 px-6 py-6 text-sm sm:px-8">
            {children}
          </div>
        </div>
      </div>
    </li>
  );
}

// ---------- 공지사항 / 자료실 -------------------------------------------------

function NoticeTab() {
  const [items, setItems] = useState<NoticeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

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

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="hidden bg-slate-50 px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 md:grid md:grid-cols-[60px_80px_1fr_100px_80px_40px] md:gap-4 items-center">
        <span className="text-center">번호</span>
        <span className="text-center">구분</span>
        <span>제목</span>
        <span className="text-center">날짜</span>
        <span className="text-center">조회수</span>
        <span></span>
      </div>
      <ul className="divide-y divide-zinc-100">
        {items.map((n) => (
          <NoticeAccordion
            key={n.id}
            notice={n}
            open={openId === n.id}
            onToggle={() => setOpenId(openId === n.id ? null : n.id)}
          />
        ))}
      </ul>
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

  return (
    <AccordionRow
      open={open}
      onToggle={onToggle}
      header={
        <div className="grid w-full grid-cols-1 items-center gap-2 md:grid-cols-[60px_80px_1fr_100px_80px] md:gap-4">
          <span className="hidden text-center text-sm font-medium text-slate-400 md:block">
            {notice.id}
          </span>
          <div className="flex justify-start md:justify-center">
            <span
              className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${
                notice.category === "notice"
                  ? "bg-slate-100 text-slate-600"
                  : "bg-blue-50 text-[var(--color-accent)] ring-1 ring-blue-500/20"
              }`}
            >
              {notice.category === "notice" ? "공지" : "자료"}
            </span>
          </div>
          <span className="flex items-center gap-2 truncate text-base font-bold text-slate-800">
            {notice.is_pinned && <Pin className="h-4 w-4 text-rose-500 shrink-0" />}
            <span className="truncate">{notice.title}</span>
          </span>
          <span className="text-xs font-medium text-slate-400 md:text-center mt-1 md:mt-0">
            {new Date(notice.created_at).toLocaleDateString("ko-KR")}
          </span>
          <span className="hidden text-center text-xs font-medium text-slate-400 md:block">
            {notice.view_count.toLocaleString()}
          </span>
        </div>
      }
    >
      <div className="mb-6 flex flex-wrap gap-4 text-xs font-medium text-slate-400 border-b border-slate-200/50 pb-4">
        <span className="text-slate-600">작성자: <strong className="text-slate-800">{notice.author_name}</strong></span>
        <span>|</span>
        <span>{new Date(notice.created_at).toLocaleString("ko-KR")}</span>
        <span>|</span>
        <span>조회 {notice.view_count.toLocaleString()}</span>
      </div>
      
      {detail ? (
        <div className="space-y-6">
          <div
            className="tiptap-content text-slate-700 text-[15px]"
            dangerouslySetInnerHTML={{ __html: richHtml(detail.content) }}
          />
          {detail.file_url && (
            <div className="pt-4">
              <a
                href={detail.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-white border border-zinc-200 px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:shadow-md"
              >
                <Download className="h-4 w-4" />
                첨부파일 다운로드
              </a>
            </div>
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

// 공지사항/Q&A/칼럼 공용 — 표 헤더 (md+ 에서만 노출, 모바일은 카드형 row 가 처리)
function PostTableHeader() {
  return (
    <div className="hidden bg-slate-50 px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 md:grid md:grid-cols-[60px_1fr_100px_80px_40px] md:gap-4 items-center">
      <span className="text-center">번호</span>
      <span>제목</span>
      <span className="text-center">날짜</span>
      <span className="text-center">조회수</span>
      <span></span>
    </div>
  );
}

// ---------- Q&A --------------------------------------------------------------

function QnaTab() {
  const router = useRouter();
  const [items, setItems] = useState<PostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [showWrite, setShowWrite] = useState(false);

  async function load() {
    try {
      const r = await getPosts("qna", 1, 100);
      setItems(r.items);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function handleWrite() {
    if (!tokenStorage.getAccess()) {
      router.push("/login?next=/community?tab=qna");
      return;
    }
    setShowWrite(true);
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-slate-500">
          궁금한 점을 자유롭게 남겨주시면 관리자가 답변해 드립니다.
        </p>
        {/* 데스크톱: 인라인 버튼 / 모바일: 하단 fixed FAB (아래) */}
        <button
          type="button"
          onClick={handleWrite}
          className="hidden items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-[var(--color-primary)]/20 transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] hover:shadow-lg sm:inline-flex"
        >
          <Edit3 className="h-4 w-4" />
          질문하기
        </button>
      </div>

      {/* 모바일 전용 floating action button — 폼이 열려있을 땐 숨김 */}
      {!showWrite ? (
        <button
          type="button"
          onClick={handleWrite}
          aria-label="질문하기"
          className="fixed bottom-6 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[var(--color-primary)]/30 transition-transform active:scale-95 sm:hidden"
        >
          <Edit3 className="h-4 w-4" />
          질문하기
        </button>
      ) : null}

      {showWrite && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <InlinePostForm
            category="qna"
            onCancel={() => setShowWrite(false)}
            onCreated={() => {
              setShowWrite(false);
              load();
            }}
          />
        </div>
      )}

      {items.length === 0 ? (
        <EmptyMessage text="등록된 질문이 없습니다. 첫 번째 질문을 남겨보세요!" icon={<MessageSquare className="h-10 w-10 text-slate-300" />} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <PostTableHeader />
          <ul className="divide-y divide-zinc-100">
            {items.map((p) => (
              <PostAccordion
                key={p.id}
                post={p}
                open={openId === p.id}
                onToggle={() => setOpenId(openId === p.id ? null : p.id)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- 전문가 칼럼 ------------------------------------------------------

function ColumnTab() {
  const [items, setItems] = useState<PostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

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

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <PostTableHeader />
      <ul className="divide-y divide-zinc-100">
        {items.map((p) => (
          <PostAccordion
            key={p.id}
            post={p}
            open={openId === p.id}
            onToggle={() => setOpenId(openId === p.id ? null : p.id)}
            scrollableBody
          />
        ))}
      </ul>
    </div>
  );
}

function PostAccordion({
  post,
  open,
  onToggle,
  scrollableBody,
}: {
  post: PostListItem;
  open: boolean;
  onToggle: () => void;
  scrollableBody?: boolean;
}) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    if (!open || content !== null) return;
    let cancelled = false;
    import("@/lib/api").then(({ getPost }) =>
      getPost(post.id)
        .then((d) => {
          if (!cancelled) setContent(d.content);
        })
        .catch(() => {
          /* ignore */
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [open, post.id, content]);

  return (
    <AccordionRow
      open={open}
      onToggle={onToggle}
      header={
        <div className="grid w-full grid-cols-1 items-center gap-2 md:grid-cols-[60px_1fr_100px_80px] md:gap-4">
          <span className="hidden text-center text-sm font-medium text-slate-400 md:block">
            {post.id}
          </span>
          <span className="truncate text-base font-bold text-slate-800">
            {post.title}
          </span>
          <span className="text-xs font-medium text-slate-400 md:text-center mt-1 md:mt-0">
            {new Date(post.created_at).toLocaleDateString("ko-KR")}
          </span>
          <span className="hidden text-center text-xs font-medium text-slate-400 md:block">
            {post.view_count.toLocaleString()}
          </span>
        </div>
      }
    >
      <div className="mb-6 flex flex-wrap gap-4 text-xs font-medium text-slate-400 border-b border-slate-200/50 pb-4">
        <span className="text-slate-600">작성자: <strong className="text-slate-800">{post.author_name}</strong></span>
        <span>|</span>
        <span>{new Date(post.created_at).toLocaleString("ko-KR")}</span>
        <span>|</span>
        <span>조회 {post.view_count.toLocaleString()}</span>
      </div>
      
      {content === null ? (
        <div className="flex items-center gap-2 text-slate-400 py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>본문을 불러오는 중입니다...</span>
        </div>
      ) : post.category === "column" ? (
        <div
          className={`tiptap-content text-slate-700 text-[15px] ${
            scrollableBody ? "max-h-[500px] overflow-y-auto pr-4 custom-scrollbar" : ""
          }`}
          dangerouslySetInnerHTML={{ __html: richHtml(content) }}
        />
      ) : (
        <div
          className={`whitespace-pre-wrap leading-relaxed text-slate-700 text-[15px] ${
            scrollableBody ? "max-h-[500px] overflow-y-auto pr-4 custom-scrollbar" : ""
          }`}
        >
          {content}
        </div>
      )}

      {post.category === "qna" && post.admin_reply ? (
        <div className="mt-6 rounded-xl border-l-4 border-emerald-500 bg-emerald-50/60 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
            관리자 답변
          </p>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">
            {post.admin_reply}
          </p>
        </div>
      ) : null}
    </AccordionRow>
  );
}

// ---------- 후기 (게시판 + 카테고리 필터) -------------------------------------

const REVIEW_CATEGORIES: string[] = [
  "준법", "음주운전", "성범죄", "성매매", "디지털성범죄",
  "마약", "도박", "피싱", "재산범죄", "스토킹", "학교폭력",
];

function matchesCategory(courseCategory: string | null, label: string): boolean {
  if (!courseCategory) return false;
  const norm = (s: string) => s.replace(/\s+/g, "");
  return norm(courseCategory).includes(norm(label));
}

const CATEGORY_BADGE: Record<string, string> = {
  준법: "bg-slate-100 text-slate-700 ring-slate-500/20",
  음주운전: "bg-rose-50 text-rose-700 ring-rose-500/20",
  성범죄: "bg-purple-50 text-purple-700 ring-purple-500/20",
  성매매: "bg-violet-50 text-violet-700 ring-violet-500/20",
  디지털성범죄: "bg-indigo-50 text-indigo-700 ring-indigo-500/20",
  마약: "bg-red-50 text-red-700 ring-red-500/20",
  도박: "bg-amber-50 text-amber-700 ring-amber-500/20",
  피싱: "bg-sky-50 text-sky-700 ring-sky-500/20",
  재산범죄: "bg-stone-50 text-stone-700 ring-stone-500/20",
  스토킹: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-500/20",
  학교폭력: "bg-emerald-50 text-emerald-700 ring-emerald-500/20",
};

function badgeClassFor(courseCategory: string | null): string {
  if (!courseCategory) return "bg-zinc-100 text-zinc-700 ring-zinc-500/20";
  for (const [label, cls] of Object.entries(CATEGORY_BADGE)) {
    if (matchesCategory(courseCategory, label)) return cls;
  }
  return "bg-zinc-100 text-zinc-700 ring-zinc-500/20";
}

function ReviewTab() {
  const router = useRouter();
  const [items, setItems] = useState<PostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);

  async function reload() {
    const r = await getPosts("review", 1, 100);
    setItems(r.items);
  }

  useEffect(() => {
    let cancelled = false;
    reload()
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => (filter == null ? items : items.filter((p) => matchesCategory(p.course_category, filter))),
    [items, filter],
  );

  function handleWriteToggle() {
    if (!tokenStorage.getAccess()) {
      router.push("/login?next=/community?tab=review");
      return;
    }
    setWriting((w) => !w);
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          카테고리
          <select
            value={filter ?? ""}
            onChange={(e) => setFilter(e.target.value === "" ? null : e.target.value)}
            className="min-w-[160px] rounded-full border border-zinc-200 bg-white px-4 py-2 pr-9 text-sm font-bold text-slate-700 shadow-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          >
            <option value="">전체</option>
            {REVIEW_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
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

      {writing && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <ReviewWriteForm
            onCancel={() => setWriting(false)}
            onCreated={async () => {
              setWriting(false);
              await reload();
            }}
          />
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyMessage text="해당 카테고리의 후기가 아직 없습니다." icon={<Star className="h-10 w-10 text-slate-300" />} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2">
          {visible.map((p) => (
            <ReviewListItem key={p.id} post={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="inline-flex gap-0.5 text-lg" aria-label={`${rating}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 ${n <= rating ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-200"}`}
        />
      ))}
    </div>
  );
}

function ReviewListItem({ post }: { post: PostListItem }) {
  const body = post.content ?? post.title;
  return (
    <li className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <StarRow rating={post.rating} />
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${badgeClassFor(post.course_category)}`}
        >
          {post.course_category ?? "기타"}
        </span>
      </div>
      <p className="flex-1 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">
        "{body}"
      </p>
      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-medium text-slate-400">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 uppercase">
            {post.author_name ? post.author_name.charAt(0) : "익"}
          </div>
          <span className="text-slate-600">{post.author_name || "익명"}</span>
        </div>
        <span>{new Date(post.created_at).toLocaleDateString("ko-KR")}</span>
      </div>
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

const FAQ_ITEMS: { q: string; a: string; cat: Exclude<FaqCategory, "all"> }[] = [
  {
    cat: "docs",
    q: "수료증 또는 상담의견서 등은 언제 어떻게 받을 수 있나요?",
    a: "수강자가 강의를 수강한 내역이 확인되면 익일 24시까지 가입하신 이메일을 통해 pdf파일로 보내드립니다.\n상담의견서는 상담 후 24시간 이내에 가입하신 이메일을 통해 pdf파일로 보내드립니다.",
  },
  {
    cat: "docs",
    q: "수료증을 재발급 받을 수 있나요?",
    a: "수료증을 재발급 받기 위해서는 법령에 따른 개인정보 보관 기간 내에 admin@kcpec.co.kr 이메일로 문의주시면 1회에 한하여 재발급해드립니다.",
  },
  {
    cat: "refund",
    q: "환불 및 취소가 가능한가요?",
    a: "결제 오류에 대한 환불이나 취소는 가능하나, 강의 수강 시작 후 또는 상담 의뢰 후 환불이나 취소는 불가합니다.",
  },
  {
    cat: "counseling",
    q: "상담 절차는 어떻게 진행되나요?",
    a: "기본 상담 절차는 이용자가 상담 설문지를 작성하여 제출하는 서면상담 방식으로 진행됩니다.\n심화상담은 의뢰를 하실 경우 상담사와 일정을 맞춘 후 상담사가 해당 시간에 이용자에게 전화를 드리거나 대면상담을 진행합니다.\n모든 상담이 종료된 후 24시간 이내에 상담의견서 등을 pdf파일로 가입하신 이메일로 보내드립니다.",
  },
  {
    cat: "docs",
    q: "발급받은 서류를 법원이나 수사기관에 제출해도 되나요?",
    a: "네, 저희 센터에서 발급한 수료증, 상담 의견서, 서약서 등 자료는 법원이나 수사기관, 학교 등 공공기관에 제출하셔도 됩니다.",
  },
  {
    cat: "etc",
    q: "양형자료만 내면 무조건 감형이 되는 건가요?",
    a: "그렇지 않습니다. 검찰이나 법원의 양형판단은 다양한 요소들을 바탕으로 종합적으로 이루어지기 때문입니다.\n다만 수료증, 상담 의견서 등 양형자료는 재범예방교육 또는 심리상담을 통해 피고인(또는 피의자)이 재범하지 않을 것을 굳게 다짐하고 있다는 사정을 경찰, 검찰이나 법원에 알리는 효과적인 방법이 될 수 있습니다.",
  },
  {
    cat: "docs",
    q: "발급받은 서류의 진위 확인이 가능한가요?",
    a: "네 가능합니다. 저희 센터에서 발급하는 서류는 워터마크가 삽입되어 있으며 문서일련번호로 진위 확인이 가능합니다.\n서류의 진위확인을 원하시는 경우, 서류 사본과 문의하실 내용을 적어 admin@kcpec.co.kr로 이메일 문의를 주시면 답변드립니다.",
  },
  {
    cat: "etc",
    q: "사건에 대한 변호사 상담을 받을 수 있나요?",
    a: "본 센터는 변호사 소개나 알선, 상담을 제공하지 않습니다.",
  },
];

function FaqTab() {
  const [cat, setCat] = useState<FaqCategory>("all");
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const visible = useMemo(
    () => (cat === "all" ? FAQ_ITEMS : FAQ_ITEMS.filter((it) => it.cat === cat)),
    [cat],
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {FAQ_CATEGORY_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setCat(t.key);
              setOpenIdx(0);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              cat === t.key
                ? "bg-[var(--color-primary)] text-white"
                : "border border-zinc-200 bg-white text-slate-600 hover:border-[var(--color-primary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyMessage
          text="해당 카테고리의 질문이 아직 없습니다."
          icon={<HelpCircle className="h-10 w-10 text-slate-300" />}
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((item, idx) => {
            const open = openIdx === idx;
            return (
              <li
                key={item.q}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : idx)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <span className="font-sans text-sm font-semibold text-slate-900 sm:text-base">
                    Q. {item.q}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[var(--color-primary)] transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {open ? (
                  <div className="whitespace-pre-line border-t border-zinc-200 bg-slate-50/50 px-5 py-4 text-sm leading-relaxed text-slate-700">
                    A. {item.a}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------- Write Forms ------------------------------------------------------

function ReviewWriteForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [rating, setRating] = useState(5);
  const [course, setCourse] = useState<string>(REVIEW_CATEGORIES[0]);
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!content.trim()) {
      setError("후기 본문을 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createPost({
        category: "review",
        title: content.trim().slice(0, 80),
        content: content.trim(),
        author_name: author.trim() || "익명",
        course_category: course,
        rating,
      });
      await onCreated();
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "후기 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 rounded-3xl border border-blue-100 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]" />
      
      <div className="flex items-center gap-2 mb-2">
        <Edit3 className="h-5 w-5 text-[var(--color-primary)]" />
        <h3 className="font-sans text-xl font-bold text-slate-900">새로운 후기 작성</h3>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700">별점</label>
          <div className="flex items-center gap-1.5 h-11">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className="transition-transform hover:scale-110 focus:outline-none"
              >
                <Star className={`h-7 w-7 ${n <= rating ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-200"}`} />
              </button>
            ))}
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700">수강 과정</label>
          <select
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            className="w-full h-11 rounded-xl border border-zinc-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          >
            {REVIEW_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700">작성자 <span className="text-slate-400 font-normal">(선택)</span></label>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            maxLength={50}
            placeholder="비워두면 '익명'"
            className="w-full h-11 rounded-xl border border-zinc-200 bg-slate-50 px-4 text-sm font-medium placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-slate-700">후기 본문</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="강의를 들으신 소감이나 다른 분들께 도움이 될 만한 내용을 남겨주세요."
          className="w-full resize-y rounded-xl border border-zinc-200 bg-slate-50 p-4 text-sm font-medium leading-relaxed placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 custom-scrollbar"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-zinc-200 px-6 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-8 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] hover:shadow-lg disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "등록 중..." : "등록하기"}
        </button>
      </div>
    </div>
  );
}

function InlinePostForm({
  category,
  onCancel,
  onCreated,
}: {
  category: "qna" | "review";
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) {
      setError("제목과 내용을 모두 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createPost({
        category,
        title: title.trim(),
        content: content.trim(),
        author_name: author.trim() || "익명",
      });
      onCreated();
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-lg shadow-slate-200/40 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-[var(--color-primary)]" />
      
      <div className="flex items-center gap-2 mb-2">
        <Edit3 className="h-5 w-5 text-[var(--color-primary)]" />
        <h3 className="font-sans text-xl font-bold text-slate-900">
          {category === "qna" ? "새 질문 작성하기" : "작성하기"}
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-1.5 text-sm">
          <label className="font-bold text-slate-700">제목</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            className="w-full h-11 rounded-xl border border-zinc-200 bg-slate-50 px-4 font-medium placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          />
        </div>
        <div className="space-y-1.5 text-sm">
          <label className="font-bold text-slate-700">작성자 <span className="text-slate-400 font-normal">(선택)</span></label>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="비워두면 '익명'"
            className="w-full h-11 rounded-xl border border-zinc-200 bg-slate-50 px-4 font-medium placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          />
        </div>
      </div>
      
      <div className="space-y-1.5 text-sm">
        <label className="font-bold text-slate-700">본문</label>
        <textarea
          rows={6}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="내용을 자세히 적어주시면 더 정확한 답변을 받을 수 있습니다."
          className="w-full resize-y rounded-xl border border-zinc-200 bg-slate-50 p-4 font-medium leading-relaxed placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 custom-scrollbar"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-zinc-200 px-6 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-8 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] hover:shadow-lg disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "등록 중..." : "질문 등록"}
        </button>
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

// 외부에서 Link 가 사용되지 않더라도, 트리쉐이킹 일관성을 위해 빈 사용 처리 (ESLint 회피).
void Link;
