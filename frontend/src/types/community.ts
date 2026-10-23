export type NoticeCategory = "notice" | "resource";
export type PostCategory = "qna" | "column" | "review";

export type CommunityCategory = NoticeCategory | PostCategory;

export const COMMUNITY_LABEL: Record<CommunityCategory, string> = {
  notice: "공지사항",
  resource: "자료실",
  qna: "1:1 문의",
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
  author_name: string;
  is_pinned: boolean;
  view_count: number;
  created_at: string;
};
export type NoticeDetail = NoticeListItem & {
  content: string;
  file_url: string | null;
  updated_at: string;
};

export type PostListItem = {
  id: number;
  title: string;
  category: PostCategory;
  author_name: string;
  course_category: string | null;
  rating: number;
  view_count: number;
  created_at: string;
  // review 카테고리 응답에만 포함됨 (별점 + 본문 한번에 노출용)
  content: string | null;
  // 관리자 답변 (Q&A 에만 의미 있음)
  admin_reply: string | null;
};
export type PostDetail = Omit<PostListItem, "content"> & {
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
  author_name?: string;
  file_url?: string;
  is_pinned?: boolean;
};
export type PostCreate = {
  title: string;
  content: string;
  category: PostCategory;
  author_name?: string;
  course_category?: string;
  course_id?: number;
  rating?: number;
};
export type PostUpdate = {
  title?: string;
  content?: string;
};

export type FaqCategory = "docs" | "refund" | "counseling" | "etc";

export const FAQ_CATEGORY_LABEL: Record<FaqCategory, string> = {
  docs: "수료증·서류",
  refund: "환불·취소",
  counseling: "상담",
  etc: "기타",
};

export type Faq = {
  id: number;
  category: FaqCategory;
  question: string;
  answer: string;
  order_index: number;
  is_active: boolean;
};

export type FaqCreate = {
  category: FaqCategory;
  question: string;
  answer: string;
  order_index?: number;
  is_active?: boolean;
};

export type FaqPatch = Partial<FaqCreate>;

// ---------- 후기 별점 요약 (홈 배지·후기 창·강의 페이지) ----------

export type ReviewItem = {
  id: number;
  author_masked: string;
  rating: number;
  content: string;
  course_id: number | null;
  course_title: string | null;
  category: string | null;
  created_at: string;
};

export type ReviewStat = { key: string; count: number; average: number };

export type ReviewCourseStat = {
  course_id: number;
  course_title: string;
  category: string;
  count: number;
  average: number;
};

export type ReviewSummary = {
  count: number;
  average: number;
  distribution: Record<string, number>;
  categories: ReviewStat[];
  courses: ReviewCourseStat[];
  recent: ReviewItem[];
};

export type PaginatedReviews = {
  items: ReviewItem[];
  total: number;
  page: number;
  size: number;
};

export type ReviewPromptState = {
  show: boolean;
  course_id: number | null;
  course_title: string | null;
  course_category: string | null;
};
