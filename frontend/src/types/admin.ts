import type { CourseCategory } from "@/types/course";
import type { CounselingStatus } from "@/types/counseling";
import type {
  IssuedDocumentStatus,
  IssuedDocumentType,
  OrderStatus,
  OrderType,
  PaymentMethod,
} from "@/types/order";

export type HealthItem = {
  name: string;
  ok: boolean;
  detail: string | null;
};

export type HealthResponse = {
  all_ok: boolean;
  checked_at: string;
  items: HealthItem[];
};

export type AdminUser = {
  id: number;
  username: string;
  email: string;
  name: string | null;
  phone: string | null;
  birth_date: string | null;
  is_active: boolean;
  is_admin: boolean;
  is_legacy_member: boolean;
  created_at: string;
  enrollment_count: number;
  payment_count: number;
  total_payment: number;
};

export type AdminUsersResponse = {
  items: AdminUser[];
  total: number;
  page: number;
  size: number;
};

export type AdminOrderRow = {
  id: number;
  user_id: number;
  username: string;
  name: string | null;
  email: string | null;
  course_title: string;
  amount: number;
  payment_method: PaymentMethod;
  status: OrderStatus;
  created_at: string;
  bundle_id: string | null;
};

export type AdminOrdersResponse = {
  items: AdminOrderRow[];
  total: number;
  page: number;
  size: number;
};

export type AdminUserBrief = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

export type AdminTopCourse = {
  course_title: string;
  revenue: number;
  percentage: number;
};

export type AdminActivity = {
  type: "order_paid" | "course_completed" | "qna_posted";
  message: string;
  created_at: string;
};

export type AdminTodoCounts = {
  pending_bank_transfer: number;
  counseling_draft_review: number;
  unanswered_qna: number;
};

export type AdminStats = {
  total_users: number;
  total_enrollments: number;
  total_orders_paid: number;
  total_revenue: number;
  today_signups: number;
  today_paid_orders: number;
  today_revenue: number;
  yesterday_new_users: number;
  yesterday_orders: number;
  yesterday_revenue: number;
  month_revenue: number;
  recent_orders: AdminOrderRow[];
  top_courses: AdminTopCourse[];
  recent_users: AdminUserBrief[];
  recent_activities: AdminActivity[];
  todo: AdminTodoCounts;
};

export type CourseEnrollmentCount = {
  course_id: number;
  course_title: string;
  category: CourseCategory;
  enrollment_count: number;
};

export type AdminLectureProgressDetail = {
  lecture_id: number;
  lecture_title: string;
  order_index: number;
  watched_seconds: number;
  duration_seconds: number;
  progress_pct: number;
  is_completed: boolean;
};

export type AdminIssuedDocumentSummary = {
  id: number;
  document_type: IssuedDocumentType;
  issue_number: string;
  status: IssuedDocumentStatus;
  issued_at: string | null;
  downloaded_at: string | null;
  pdf_url: string | null;
  pledge_pdf_url: string | null;
};

export type AdminUserEnrollmentRow = {
  enrollment_id: number;
  course_id: number;
  course_title: string;
  // 백엔드 CourseCategory 는 일반 6개 카테고리 + "심리상담"(COUNSELING)이
  // 있는데, 공개 강의 탐색용 CourseCategory 타입(types/course.ts)은
  // 심리상담을 일부러 빼뒀다(그 필터/탐색 화면엔 상담 강의가 아예 안
  // 나오므로) — 이 관리자 전용 필드는 그 타입을 그대로 못 쓴다.
  category: CourseCategory | "심리상담";
  overall_progress_pct: number;
  is_completed: boolean;
  quiz_passed: boolean;
  has_quiz: boolean;
  survey_status: CounselingStatus | null;
  // null 이면 수강기간 제한 없음(레거시 enrollment).
  expires_at: string | null;
  lectures: AdminLectureProgressDetail[];
  document: AdminIssuedDocumentSummary | null;
};

export type NoticePatch = {
  title?: string;
  content?: string;
  file_url?: string | null;
  is_pinned?: boolean;
};

export type PostPatch = {
  title?: string;
  content?: string;
};

export type AdminSurveyRow = {
  id: number;
  order_id: number;
  order_type: OrderType;
  username: string;
  course_title: string;
  status: CounselingStatus;
  submitted_at: string;
  draft_sent_at: string | null;
  completed_at: string | null;
  ai_draft_url: string | null;
  final_pdf_url: string | null;
};

export type AdminSurveyDetail = AdminSurveyRow & {
  // personal 같은 nested object 도 허용
  responses: Record<string, unknown>;
  user_email: string | null;
};

export type AdminCourseCreate = {
  title: string;
  description?: string;
  category: CourseCategory;
  price: number;
  // 할인 전 정가 — 지정 시 price 보다 커야 함.
  original_price?: number | null;
  thumbnail_url?: string;
  min_progress_pct?: number;
  quiz_pass_score?: number;
};

export type AdminLectureCreate = {
  title: string;
  // order_index 는 백엔드가 자동 할당 (현재 lecture 수 + 1).
  order_index?: number;
  video_url?: string;
  duration_seconds?: number;
};

export type AdminLectureFull = {
  id: number;
  title: string;
  order_index: number;
  video_url: string | null;
  duration_seconds: number;
  is_active: boolean;
};

export type AdminLecturePatch = {
  title?: string;
  order_index?: number;
  video_url?: string | null;
  duration_seconds?: number;
  is_active?: boolean;
};

export type AdminCoursePatch = {
  title?: string;
  description?: string;
  category?: string;
  price?: number;
  original_price?: number | null;
  thumbnail_url?: string;
  min_progress_pct?: number;
  quiz_pass_score?: number;
  is_active?: boolean;
};

export type AdminQuizQuestion = {
  question_text: string;
  options: { option_text: string; is_correct: boolean }[];
};

export type SalesStatsDaily = {
  date: string;
  revenue: number;
  orders: number;
  counseling_revenue: number;
};

export type SalesStatsHourly = {
  hour: number;
  orders: number;
  revenue: number;
};

export type SalesStatsByCourse = {
  course_title: string;
  // AdminUserEnrollmentRow.category 와 동일한 이유로 "심리상담"까지 포함.
  category: CourseCategory | "심리상담";
  count: number;
  revenue: number;
};

export type SalesStatsByPayment = {
  method: PaymentMethod;
  count: number;
  revenue: number;
};

export type SalesStats = {
  this_month_revenue: number;
  this_month_orders: number;
  last_month_revenue: number;
  avg_order_amount: number;
  daily_revenue: SalesStatsDaily[];
  by_course: SalesStatsByCourse[];
  by_payment: SalesStatsByPayment[];
  counseling_revenue: number;
  hourly: SalesStatsHourly[];
};

export type VisitorStatsDaily = {
  date: string;
  new_users: number;
};

export type VisitorStats = {
  new_users_this_month: number;
  new_users_last_month: number;
  total_enrollments: number;
  conversion_rate: number;
  avg_courses_per_user: number;
  daily_signups: VisitorStatsDaily[];
};

export type AdminQuizOptionRead = {
  id: number;
  option_text: string;
  is_correct: boolean;
};

export type AdminQuizQuestionRead = {
  id: number;
  question_text: string;
  order_index: number;
  options: AdminQuizOptionRead[];
};

export type AdminQuizRead = {
  exists: boolean;
  questions: AdminQuizQuestionRead[];
};
