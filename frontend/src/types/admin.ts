import type { CourseCategory } from "@/types/course";
import type { CounselingStatus } from "@/types/counseling";
import type { OrderStatus, OrderType, PaymentMethod } from "@/types/order";

export type AdminUser = {
  id: number;
  username: string;
  email: string;
  birth_date: string | null;
  is_active: boolean;
  is_admin: boolean;
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
  email: string | null;
  course_title: string;
  package_name: string;
  amount: number;
  payment_method: PaymentMethod;
  status: OrderStatus;
  created_at: string;
};

export type AdminOrdersResponse = {
  items: AdminOrderRow[];
  total: number;
  page: number;
  size: number;
};

export type AdminStats = {
  total_users: number;
  total_enrollments: number;
  total_orders_paid: number;
  total_revenue: number;
  today_signups: number;
  today_paid_orders: number;
  today_revenue: number;
  month_revenue: number;
  recent_orders: AdminOrderRow[];
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

export type AdminUserEnrollmentRow = {
  course_id: number;
  course_title: string;
  category: CourseCategory;
  overall_progress_pct: number;
  is_completed: boolean;
  quiz_passed: boolean;
  lectures: AdminLectureProgressDetail[];
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
  responses: Record<string, string>;
  user_email: string | null;
};

export type AdminCourseCreate = {
  title: string;
  description?: string;
  category: CourseCategory;
  price: number;
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
  thumbnail_url?: string;
  min_progress_pct?: number;
  quiz_pass_score?: number;
  is_active?: boolean;
};

export type AdminQuizQuestion = {
  question_text: string;
  options: { option_text: string; is_correct: boolean }[];
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
