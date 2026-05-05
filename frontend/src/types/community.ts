export type NoticeCategory = "notice" | "resource";
export type PostCategory = "qna" | "column" | "review";

export type CommunityCategory = NoticeCategory | PostCategory;

export const COMMUNITY_LABEL: Record<CommunityCategory, string> = {
  notice: "공지사항",
  resource: "자료실",
  qna: "Q&A",
  column: "전문가 칼럼",
  review: "수강 후기",
};

// 어떤 카테고리가 notices 테이블에 속하는지 구분
export const NOTICE_CATEGORIES: NoticeCategory[] = ["notice", "resource"];
export const POST_CATEGORIES: PostCategory[] = ["qna", "column", "review"];

export function isNoticeCategory(c: string): c is NoticeCategory {
  return c === "notice" || c === "resource";
}
export function isPostCategory(c: string): c is PostCategory {
  return c === "qna" || c === "column" || c === "review";
}

export type NoticeListItem = {
  id: number;
  title: string;
  category: NoticeCategory;
  is_pinned: boolean;
  created_at: string;
};
export type NoticeDetail = NoticeListItem & {
  content: string;
  file_url: string | null;
  view_count: number;
  updated_at: string;
};

export type PostListItem = {
  id: number;
  title: string;
  category: PostCategory;
  author_name: string;
  view_count: number;
  created_at: string;
};
export type PostDetail = PostListItem & {
  content: string;
};

export type PaginatedNotices = {
  items: NoticeListItem[];
  total: number;
  page: number;
  size: number;
};
export type PaginatedPosts = {
  items: PostListItem[];
  total: number;
  page: number;
  size: number;
};

export type NoticeCreate = {
  title: string;
  content: string;
  category: NoticeCategory;
  file_url?: string;
  is_pinned?: boolean;
};
export type PostCreate = {
  title: string;
  content: string;
  category: PostCategory;
  author_name?: string;
};
