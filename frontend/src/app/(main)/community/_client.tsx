"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getNotices, getPosts } from "@/lib/api";
import {
  COMMUNITY_LABEL,
  type NoticeCategory,
  type NoticeListItem,
  type PostCategory,
  type PostListItem,
} from "@/types/community";

type SectionData =
  | { kind: "notice"; category: NoticeCategory; items: NoticeListItem[] }
  | { kind: "post"; category: PostCategory; items: PostListItem[] };

const SECTIONS: { kind: "notice" | "post"; cat: string; description: string }[] = [
  { kind: "notice", cat: "notice", description: "센터 운영·서비스 변경 사항을 안내합니다." },
  { kind: "notice", cat: "resource", description: "양형 자료 작성에 도움되는 참고 문서." },
  { kind: "post", cat: "qna", description: "수강·상담 관련 질문을 자유롭게 남겨주세요." },
  { kind: "post", cat: "column", description: "전문가가 직접 작성하는 심리·법률 칼럼." },
  { kind: "post", cat: "review", description: "수강·상담을 마친 분들의 후기." },
];

export default function CommunityHubClient() {
  const [data, setData] = useState<SectionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      SECTIONS.map(async (s) => {
        if (s.kind === "notice") {
          const r = await getNotices(s.cat as NoticeCategory, 1, 3).catch(() => null);
          return {
            kind: "notice" as const,
            category: s.cat as NoticeCategory,
            items: r?.items ?? [],
          };
        }
        const r = await getPosts(s.cat as PostCategory, 1, 3).catch(() => null);
        return {
          kind: "post" as const,
          category: s.cat as PostCategory,
          items: r?.items ?? [],
        };
      }),
    )
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 pb-24">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]">
          Community
        </p>
        <h1 className="mt-3 font-sans text-3xl font-extrabold tracking-tight text-[var(--color-primary)] sm:text-4xl">
          커뮤니티
        </h1>
        <p className="mt-3 text-base text-slate-600">
          공지사항과 자료실, Q&amp;A·전문가 칼럼·수강 후기를 한 곳에서 확인하세요.
        </p>
      </header>

      {loading ? (
        <p className="mt-12 text-center text-sm text-slate-500">불러오는 중...</p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.map((s) => {
            const cat = s.category;
            const label = COMMUNITY_LABEL[cat];
            const desc =
              SECTIONS.find((x) => x.cat === cat)?.description ?? "";
            return (
              <Link
                key={cat}
                href={`/community/${cat}`}
                className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-baseline justify-between">
                  <h2 className="font-sans text-lg font-bold text-[var(--color-primary)]">
                    {label}
                  </h2>
                  <span className="text-xs text-[var(--color-accent)] group-hover:underline">
                    더보기 →
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{desc}</p>
                <ul className="mt-5 space-y-2 border-t border-zinc-100 pt-4 text-sm">
                  {s.items.length === 0 ? (
                    <li className="text-xs text-zinc-400">등록된 글이 없습니다.</li>
                  ) : (
                    s.items.map((it) => (
                      <li key={it.id} className="flex items-center gap-2 truncate">
                        {"is_pinned" in it && it.is_pinned ? (
                          <span className="text-[var(--color-accent)]">📌</span>
                        ) : null}
                        <span className="truncate text-slate-700 group-hover:text-[var(--color-primary)]">
                          {it.title}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
