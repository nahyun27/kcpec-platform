"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { TiptapEditor } from "@/components/ui/TiptapEditor";
import {
  createNotice,
  createPost,
  deleteAdminNotice,
  deleteAdminPost,
  getNotices,
  getPosts,
  patchAdminNotice,
  patchAdminPost,
  patchAdminPostReply,
} from "@/lib/api";
import {
  COMMUNITY_LABEL,
  type CommunityCategory,
  type NoticeCategory,
  type NoticeListItem,
  type PostCategory,
  type PostListItem,
} from "@/types/community";

type UnifiedRow = {
  table: "notice" | "post";
  id: number;
  category: CommunityCategory;
  title: string;
  author: string;
  view_count: number;
  created_at: string;
  is_pinned?: boolean;
  // Q&A 답변 모달용 (Q&A 카테고리에서만 채워짐)
  question_content?: string | null;
  admin_reply?: string | null;
};

// 작성자 표시 규칙: 사용자 생성 카테고리(QNA/REVIEW)는 실제 author_name,
// 그 외는 "관리자" 로 통일.
function displayAuthor(category: CommunityCategory, author: string): string {
  if (category === "qna" || category === "review") return author;
  return "관리자";
}

type Filter = "all" | CommunityCategory;

const SIDEBAR: { key: Filter; label: string }[] = [
  { key: "all", label: "전체 게시물" },
  { key: "notice", label: "공지사항" },
  { key: "resource", label: "자료실" },
  { key: "qna", label: "Q&A" },
  { key: "column", label: "전문가 칼럼" },
  { key: "review", label: "수강 후기" },
];

const ADMIN_WRITABLE: CommunityCategory[] = ["notice", "resource", "column"];

export default function AdminCommunityPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [notices, setNotices] = useState<NoticeListItem[]>([]);
  const [qnas, setQnas] = useState<PostListItem[]>([]);
  const [columns, setColumns] = useState<PostListItem[]>([]);
  const [reviews, setReviews] = useState<PostListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UnifiedRow | null>(null);
  const [replying, setReplying] = useState<UnifiedRow | null>(null);

  async function reload() {
    setError(null);
    try {
      const [n, q, c, r] = await Promise.all([
        getNotices(undefined, 1, 100),
        getPosts("qna", 1, 100),
        getPosts("column", 1, 100),
        getPosts("review", 1, 100),
      ]);
      setNotices(n.items);
      setQnas(q.items);
      setColumns(c.items);
      setReviews(r.items);
    } catch {
      setError("목록을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: notices.length + qnas.length + columns.length + reviews.length,
      notice: notices.filter((n) => n.category === "notice").length,
      resource: notices.filter((n) => n.category === "resource").length,
      qna: qnas.length,
      column: columns.length,
      review: reviews.length,
    };
    return c;
  }, [notices, qnas, columns, reviews]);

  const rows = useMemo<UnifiedRow[]>(() => {
    const all: UnifiedRow[] = [
      ...notices.map<UnifiedRow>((n) => ({
        table: "notice",
        id: n.id,
        category: n.category,
        title: n.title,
        author: n.author_name,
        view_count: n.view_count,
        created_at: n.created_at,
        is_pinned: n.is_pinned,
      })),
      ...qnas.map<UnifiedRow>((p) => ({
        table: "post",
        id: p.id,
        category: "qna",
        title: p.title,
        author: p.author_name,
        view_count: p.view_count,
        created_at: p.created_at,
        question_content: p.content,
        admin_reply: p.admin_reply,
      })),
      ...columns.map<UnifiedRow>((p) => ({
        table: "post",
        id: p.id,
        category: "column",
        title: p.title,
        author: p.author_name,
        view_count: p.view_count,
        created_at: p.created_at,
      })),
      ...reviews.map<UnifiedRow>((p) => ({
        table: "post",
        id: p.id,
        category: "review",
        title: p.title,
        author: p.author_name,
        view_count: p.view_count,
        created_at: p.created_at,
      })),
    ];
    const filtered = filter === "all" ? all : all.filter((r) => r.category === filter);
    return filtered.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [filter, notices, qnas, columns, reviews]);

  async function handleDelete(row: UnifiedRow) {
    if (!confirm(`"${row.title}" 을(를) 삭제하시겠습니까?`)) return;
    try {
      if (row.table === "notice") await deleteAdminNotice(row.id);
      else await deleteAdminPost(row.id);
      await reload();
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      alert(detail ?? "삭제에 실패했습니다.");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">
            게시물 관리
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            공지·자료실·전문가 칼럼 등록 및 사용자 게시물 검열
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
        >
          + 게시물 작성
        </button>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-1 rounded-lg border border-zinc-200 bg-white p-3 text-sm">
          {SIDEBAR.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setFilter(s.key)}
              className={`flex w-full items-center justify-between rounded px-3 py-2 text-left transition-colors ${
                filter === s.key
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-zinc-700 hover:bg-slate-50"
              }`}
            >
              <span>{s.label}</span>
              <span className="text-xs">{counts[s.key].toLocaleString()}</span>
            </button>
          ))}
        </aside>

        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-3">카테고리</th>
                <th className="px-3 py-3">제목</th>
                <th className="px-3 py-3">작성자</th>
                <th className="px-3 py-3 text-right">조회수</th>
                <th className="px-3 py-3">작성일</th>
                <th className="px-3 py-3">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500">
                    게시물이 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={`${r.table}-${r.id}`}>
                    <td className="px-3 py-3 text-xs">
                      <CategoryBadge category={r.category} />
                    </td>
                    <td className="max-w-[280px] px-3 py-3">
                      <div className="flex items-center gap-1">
                        {r.is_pinned ? (
                          <span className="text-[var(--color-accent)]">📌</span>
                        ) : null}
                        <span
                          title={r.title}
                          className="block truncate text-sm text-zinc-800"
                        >
                          {r.title}
                        </span>
                        {r.category === "qna" && r.admin_reply ? (
                          <span className="ml-1 shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            답변완료
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-600">
                      {displayAuthor(r.category, r.author)}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-zinc-500">
                      {r.view_count.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-500">
                      {new Date(r.created_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-3 py-3">
                      <RowActions
                        row={r}
                        onEdit={() => setEditing(r)}
                        onReply={() => setReplying(r)}
                        onDelete={() => handleDelete(r)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen ? (
        <CreateModal onClose={() => setCreateOpen(false)} onCreated={reload} />
      ) : null}
      {editing ? (
        <EditModal row={editing} onClose={() => setEditing(null)} onSaved={reload} />
      ) : null}
      {replying ? (
        <ReplyModal
          row={replying}
          onClose={() => setReplying(null)}
          onSaved={reload}
        />
      ) : null}
    </div>
  );
}

function RowActions({
  row,
  onEdit,
  onReply,
  onDelete,
}: {
  row: UnifiedRow;
  onEdit: () => void;
  onReply: () => void;
  onDelete: () => void;
}) {
  const editBtn = (
    <button
      key="edit"
      type="button"
      onClick={onEdit}
      className="rounded border border-zinc-300 px-2.5 py-1 text-xs hover:border-[var(--color-primary)]"
    >
      수정
    </button>
  );
  const replyBtn = (
    <button
      key="reply"
      type="button"
      onClick={onReply}
      className="rounded bg-[var(--color-primary)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)]"
    >
      {row.admin_reply ? "답변 수정" : "답변하기"}
    </button>
  );
  const deleteBtn = (
    <button
      key="delete"
      type="button"
      onClick={onDelete}
      className="rounded border border-red-300 px-2.5 py-1 text-xs text-red-600 hover:border-red-500"
    >
      삭제
    </button>
  );

  // 카테고리별 액션:
  // - notice / resource / column : 수정 + 삭제
  // - qna : 답변 + 삭제
  // - review : 삭제만
  const actions =
    row.category === "qna"
      ? [replyBtn, deleteBtn]
      : row.category === "review"
        ? [deleteBtn]
        : [editBtn, deleteBtn];

  return <div className="flex gap-1.5">{actions}</div>;
}

function CategoryBadge({ category }: { category: CommunityCategory }) {
  const map: Record<CommunityCategory, string> = {
    notice: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
    resource: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
    qna: "bg-blue-100 text-blue-700",
    column: "bg-violet-100 text-violet-700",
    review: "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${map[category]}`}>
      {COMMUNITY_LABEL[category]}
    </span>
  );
}

// ---------- modals ---------------------------------------------------------

const inputCls =
  "w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20";

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    // 의도적으로 backdrop 클릭으로 닫지 않음 — 작성/수정/답변 폼 내용이
    // 실수로 사라지는 것을 방지. 닫으려면 우상단 "닫기" 또는 각 폼의 "취소".
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-sans text-lg font-bold text-[var(--color-primary)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-900"
          >
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [category, setCategory] = useState<CommunityCategory>("notice");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [author, setAuthor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!content.trim()) {
      setErr("본문을 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    try {
      if (category === "notice" || category === "resource") {
        await createNotice({
          title: title.trim(),
          content: content.trim(),
          category: category as NoticeCategory,
          file_url: fileUrl.trim() || undefined,
          is_pinned: pinned,
        });
      } else {
        // 관리자가 등록 가능한 post 카테고리는 column 만 (qna/review 는 사용자 측에서 작성)
        await createPost({
          title: title.trim(),
          content: content.trim(),
          category: category as PostCategory,
          author_name: author.trim() || "전문가",
        });
      }
      onCreated();
      onClose();
    } catch (caught) {
      const detail = isAxiosError(caught)
        ? (caught.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setErr(detail ?? "등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const isNotice = category === "notice" || category === "resource";

  return (
    <ModalShell title="게시물 작성" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="카테고리">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CommunityCategory)}
            className={inputCls}
          >
            {ADMIN_WRITABLE.map((c) => (
              <option key={c} value={c}>
                {COMMUNITY_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="제목">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </Field>
        {!isNotice ? (
          <Field label="작성자 (전문가 명)">
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className={inputCls}
              placeholder="전문가"
            />
          </Field>
        ) : null}
        <Field label="본문">
          <TiptapEditor
            initialHtml=""
            onChange={setContent}
            placeholder="본문을 입력하세요. 굵게 / 기울임 / 제목 / 인용 / 목록 사용 가능."
          />
        </Field>
        {isNotice ? (
          <>
            <Field label="첨부파일 URL (선택)">
              <input
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                className={inputCls}
                placeholder="https://..."
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="accent-[var(--color-primary)]"
              />
              상단 고정 (📌)
            </label>
          </>
        ) : null}
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-300 px-4 py-2 text-sm"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {submitting ? "등록 중..." : "등록"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function EditModal({
  row,
  onClose,
  onSaved,
}: {
  row: UnifiedRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(row.title);
  const [content, setContent] = useState(""); // 비어 있으면 변경 안 함
  const [pinned, setPinned] = useState(row.is_pinned ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 첫 진입 시 본문은 별도 상세 호출이 필요하지만 list 응답에 없어서
  // 비워두고 placeholder 로 안내. 사용자가 본문을 입력해야만 변경됨.

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      if (row.table === "notice") {
        const payload: { title?: string; content?: string; is_pinned?: boolean } = {
          title: title.trim(),
          is_pinned: pinned,
        };
        if (content.trim()) payload.content = content.trim();
        await patchAdminNotice(row.id, payload);
      } else {
        const payload: { title?: string; content?: string } = { title: title.trim() };
        if (content.trim()) payload.content = content.trim();
        await patchAdminPost(row.id, payload);
      }
      onSaved();
      onClose();
    } catch (caught) {
      const detail = isAxiosError(caught)
        ? (caught.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setErr(detail ?? "수정에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title={`수정 — ${COMMUNITY_LABEL[row.category]}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="제목">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="본문 (변경 시에만 입력)">
          <TiptapEditor
            initialHtml=""
            onChange={setContent}
            placeholder="비워두면 본문은 변경되지 않습니다. 입력 시 굵게/제목/인용/목록 사용 가능."
          />
        </Field>
        {row.table === "notice" ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="accent-[var(--color-primary)]"
            />
            상단 고정 (📌)
          </label>
        ) : null}
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-300 px-4 py-2 text-sm"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {submitting ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ReplyModal({
  row,
  onClose,
  onSaved,
}: {
  row: UnifiedRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reply, setReply] = useState(row.admin_reply ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!reply.trim()) {
      setErr("답변 내용을 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await patchAdminPostReply(row.id, reply.trim());
      onSaved();
      onClose();
    } catch (caught) {
      const detail = isAxiosError(caught)
        ? (caught.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setErr(detail ?? "답변 저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title={row.admin_reply ? "답변 수정" : "답변하기"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-800">질문</label>
          <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm">
            <p className="font-semibold text-slate-900">{row.title}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {row.author} · {new Date(row.created_at).toLocaleDateString("ko-KR")}
            </p>
            {row.question_content ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {row.question_content}
              </p>
            ) : null}
          </div>
        </div>
        <Field label="답변">
          <textarea
            required
            rows={6}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className={`${inputCls} resize-y`}
            placeholder="답변 내용을 입력해 주세요."
          />
        </Field>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-300 px-4 py-2 text-sm"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {submitting ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-zinc-800">{label}</label>
      {children}
    </div>
  );
}
