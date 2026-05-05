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

type TabKey = "notice" | "qna" | "column" | "review";

const TABS: { key: TabKey; label: string }[] = [
  { key: "notice", label: "공지사항 및 자료실" },
  { key: "qna", label: "Q&A" },
  { key: "column", label: "전문가 칼럼" },
  { key: "review", label: "강의 수강 및 상담 후기" },
];

function isTabKey(s: string | null): s is TabKey {
  return s === "notice" || s === "qna" || s === "column" || s === "review";
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
    <div className="mx-auto max-w-5xl px-6 py-12 pb-24">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]">
          Community
        </p>
        <h1 className="mt-3 font-sans text-3xl font-extrabold tracking-tight text-[var(--color-primary)] sm:text-4xl">
          커뮤니티
        </h1>
        <p className="mt-3 text-base text-slate-600">
          공지사항·자료실·Q&amp;A·전문가 칼럼·수강 후기를 한 곳에서 확인하세요.
        </p>
      </header>

      <div className="mt-8 border-b border-zinc-200">
        <div className="-mb-px flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-3 text-sm font-semibold transition-colors ${
                tab === t.key
                  ? "text-[var(--color-primary)]"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
              {tab === t.key ? (
                <span className="absolute -bottom-px left-0 h-0.5 w-full bg-[var(--color-primary)]" />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {tab === "notice" ? <NoticeTab /> : null}
        {tab === "qna" ? <QnaTab /> : null}
        {tab === "column" ? <ColumnTab /> : null}
        {tab === "review" ? <ReviewTab /> : null}
      </div>
    </div>
  );
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
    <li className="overflow-hidden border-b border-zinc-200 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
          open ? "bg-slate-50" : "hover:bg-slate-50/50"
        }`}
      >
        {header}
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">{children}</div>
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
  if (items.length === 0) return <EmptyMessage text="등록된 글이 없습니다." />;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="hidden bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 md:grid md:grid-cols-[60px_90px_1fr_120px_80px] md:gap-3">
        <span className="text-center">번호</span>
        <span>구분</span>
        <span>제목</span>
        <span className="text-right">날짜</span>
        <span className="text-right">조회수</span>
      </div>
      <ul>
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
        <div className="grid w-full grid-cols-1 items-baseline gap-1 md:grid-cols-[60px_90px_1fr_120px_80px] md:gap-3">
          <span className="hidden text-center text-xs text-slate-500 md:inline">
            {notice.id}
          </span>
          <span
            className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
              notice.category === "notice"
                ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                : "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
            } w-fit md:w-auto`}
          >
            {notice.category === "notice" ? "공지" : "자료"}
          </span>
          <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-900">
            {notice.is_pinned ? (
              <span className="text-[var(--color-accent)]">📌</span>
            ) : null}
            <span className="truncate">{notice.title}</span>
          </span>
          <span className="text-xs text-slate-500 md:text-right">
            {new Date(notice.created_at).toLocaleDateString("ko-KR")}
          </span>
          <span className="text-xs text-slate-400 md:text-right">
            조회 {notice.view_count.toLocaleString()}
          </span>
        </div>
      }
    >
      <div className="border-t border-zinc-100 bg-slate-50/40 px-5 py-5 text-sm">
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-500">
          <span>작성자: {notice.author_name}</span>
          <span>·</span>
          <span>{new Date(notice.created_at).toLocaleString("ko-KR")}</span>
          <span>·</span>
          <span>조회 {notice.view_count.toLocaleString()}</span>
        </div>
        {detail ? (
          <>
            <div className="whitespace-pre-wrap leading-relaxed text-slate-700">
              {detail.content}
            </div>
            {detail.file_url ? (
              <a
                href={detail.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded bg-[var(--color-accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)]"
              >
                📎 첨부파일 다운로드
              </a>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-slate-400">불러오는 중...</p>
        )}
      </div>
    </AccordionRow>
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleWrite}
          className="rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
        >
          + 질문하기
        </button>
      </div>

      {showWrite ? (
        <InlinePostForm
          category="qna"
          onCancel={() => setShowWrite(false)}
          onCreated={() => {
            setShowWrite(false);
            load();
          }}
        />
      ) : null}

      {items.length === 0 ? (
        <EmptyMessage text="등록된 질문이 없습니다." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <ul>
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
  if (items.length === 0) return <EmptyMessage text="등록된 칼럼이 없습니다." />;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <ul>
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
        <div className="grid w-full grid-cols-1 items-baseline gap-1 md:grid-cols-[60px_1fr_120px_80px] md:gap-3">
          <span className="hidden text-center text-xs text-slate-500 md:inline">
            {post.id}
          </span>
          <span className="truncate text-sm font-semibold text-slate-900">
            {post.title}
          </span>
          <span className="text-xs text-slate-500 md:text-right">
            {new Date(post.created_at).toLocaleDateString("ko-KR")}
          </span>
          <span className="text-xs text-slate-400 md:text-right">
            조회 {post.view_count.toLocaleString()}
          </span>
        </div>
      }
    >
      <div className="border-t border-zinc-100 bg-slate-50/40 px-5 py-5 text-sm">
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-500">
          <span>작성자: {post.author_name}</span>
          <span>·</span>
          <span>{new Date(post.created_at).toLocaleString("ko-KR")}</span>
        </div>
        {content === null ? (
          <p className="text-xs text-slate-400">불러오는 중...</p>
        ) : (
          <div
            className={`whitespace-pre-wrap leading-relaxed text-slate-700 ${
              scrollableBody ? "max-h-[400px] overflow-y-auto pr-2" : ""
            }`}
          >
            {content}
          </div>
        )}
      </div>
    </AccordionRow>
  );
}

// ---------- 후기 (그리드) -----------------------------------------------------

const COURSE_GRADIENT: Record<string, string> = {
  "음주운전 예방": "from-rose-500 to-orange-500",
  "성범죄 예방": "from-purple-500 to-pink-500",
  "디지털 성범죄 예방": "from-indigo-600 to-blue-500",
  "준법의식 강화": "from-emerald-600 to-teal-500",
  "마약 예방": "from-red-600 to-rose-500",
  "도박 및 도박개장 예방": "from-amber-600 to-yellow-500",
  "피싱범죄 예방": "from-sky-600 to-cyan-500",
  "사기횡령배임 등 재산범죄 예방": "from-stone-600 to-zinc-500",
  "스토킹범죄 예방": "from-fuchsia-600 to-purple-500",
  "학교폭력 예방": "from-lime-600 to-emerald-500",
  "성매매 예방": "from-violet-600 to-purple-500",
};

function ReviewTab() {
  const [items, setItems] = useState<PostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoOnly, setPhotoOnly] = useState(false); // 추후 photo_url 도입 시 사용

  useEffect(() => {
    let cancelled = false;
    getPosts("review", 1, 100)
      .then((r) => !cancelled && setItems(r.items))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // 현재는 photo 필드가 없으므로 photoOnly 필터는 빈 결과 안내 용도.
  const visible = useMemo(
    () => (photoOnly ? items.filter(() => false) : items),
    [items, photoOnly],
  );

  if (loading) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-2 text-sm">
        <button
          type="button"
          onClick={() => setPhotoOnly(false)}
          className={`rounded-full px-4 py-1.5 font-semibold transition-colors ${
            !photoOnly
              ? "bg-[var(--color-primary)] text-white"
              : "border border-zinc-200 text-slate-600 hover:border-[var(--color-primary)]"
          }`}
        >
          전체
        </button>
        <button
          type="button"
          onClick={() => setPhotoOnly(true)}
          className={`rounded-full px-4 py-1.5 font-semibold transition-colors ${
            photoOnly
              ? "bg-[var(--color-primary)] text-white"
              : "border border-zinc-200 text-slate-600 hover:border-[var(--color-primary)]"
          }`}
        >
          포토 후기만 보기
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyMessage text="해당 조건의 후기가 아직 없습니다." />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((p) => (
            <ReviewCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ post }: { post: PostListItem }) {
  const gradient =
    (post.course_category && COURSE_GRADIENT[post.course_category]) ||
    "from-slate-600 to-slate-400";
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div
        className={`flex aspect-[4/3] items-center justify-center bg-gradient-to-br ${gradient} p-4 text-center text-xs font-bold tracking-widest text-white/90`}
      >
        {post.course_category ?? "KCPEC"}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* PostListItem 응답에 본문이 없으므로 title(첫 80자) 을 카드 미리보기로 사용. */}
        <p className="line-clamp-4 text-sm leading-relaxed text-slate-700">{post.title}</p>
        <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-3 text-xs text-slate-500">
          <span>{post.author_name}</span>
          <span>{new Date(post.created_at).toLocaleDateString("ko-KR")}</span>
        </div>
      </div>
    </article>
  );
}

// PostListItem 은 content 필드를 노출하지 않으므로, 카드용으로 미리 받아야 한다.
// 백엔드 /posts 응답에 content 가 없으니 후기는 첫 진입 시 detail 을 한번씩 받는다.
// 단순화를 위해 ReviewCard 는 title (= content 첫 80자) 을 사용한다.

// ---------- inline write form ------------------------------------------------

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
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="font-sans text-base font-bold text-[var(--color-primary)]">
        {category === "qna" ? "질문 작성" : "후기 작성"}
      </h3>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
      />
      <input
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="작성자 (비워두면 '익명')"
        className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
      />
      <textarea
        rows={5}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="내용"
        className="w-full resize-y rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
      />
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
        >
          {submitting ? "등록 중..." : "등록"}
        </button>
      </div>
    </div>
  );
}

// ---------- shared status panes ---------------------------------------------

function Loading() {
  return (
    <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-500">
      불러오는 중...
    </div>
  );
}
function ErrorMessage({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 py-12 text-center text-sm text-red-600">
      {text}
    </div>
  );
}
function EmptyMessage({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white py-16 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}

// 외부에서 Link 가 사용되지 않더라도, 트리쉐이킹 일관성을 위해 빈 사용 처리 (ESLint 회피).
void Link;
