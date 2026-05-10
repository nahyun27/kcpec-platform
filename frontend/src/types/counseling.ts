export type CounselingStatus =
  | "submitted"
  | "draft_generated"
  | "sent_to_staff"
  | "completed";

export const COUNSELING_STATUS_LABEL: Record<CounselingStatus, string> = {
  submitted: "검토 대기",
  draft_generated: "초안 생성 완료",
  sent_to_staff: "검토 중 🕐",
  completed: "완료",
};

export type SurveyResponse = {
  id: number;
  order_id: number;
  status: CounselingStatus;
  submitted_at: string;
  final_pdf_url: string | null;
};

export type SurveyStatusResponse = {
  id: number;
  status: CounselingStatus;
  submitted_at: string;
  draft_sent_at: string | null;
  completed_at: string | null;
  final_pdf_url: string | null;
};

export type SurveyDetail = {
  id: number;
  order_id: number;
  status: CounselingStatus;
  responses: Record<string, string>;
  submitted_at: string;
  ai_draft_url: string | null;
  final_pdf_url: string | null;
};

export type EnrollmentWithProgress = {
  course_id: number;
  course_title: string;
  category: string;
  is_completed: boolean;
  overall_progress_pct: number;
  has_quiz: boolean;
};

// 전문가 심리상담 독립 구매
export type CounselingType = "basic" | "phone" | "inperson";

export const COUNSELING_PROGRAM_LABEL: Record<CounselingType, string> = {
  basic: "기본 프로그램",
  phone: "전화 심화상담",
  inperson: "대면 심화상담",
};

export type CounselingPurchaseResponse = {
  order_id: number;
  course_id: number;
  amount: number;
  status: "pending" | "paid" | "cancelled" | "refunded";
  payment_method: "card" | "kakaopay" | "naverpay" | "bank_transfer";
  requires_payment: boolean;
  counseling_type: CounselingType;
};

export type CounselingOrderItem = {
  order_id: number;
  counseling_type: CounselingType;
  program_title: string;
  amount: number;
  status: "pending" | "paid" | "cancelled" | "refunded";
  payment_method: "card" | "kakaopay" | "naverpay" | "bank_transfer";
  created_at: string;
  paid_at: string | null;
  survey_id: number | null;
  survey_status: CounselingStatus | null;
  final_pdf_url: string | null;
};
