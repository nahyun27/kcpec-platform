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
  status: CounselingStatus;
  submitted_at: string;
  draft_sent_at: string | null;
  completed_at: string | null;
  final_pdf_url: string | null;
};

export type EnrollmentWithProgress = {
  course_id: number;
  course_title: string;
  category: string;
  is_completed: boolean;
  overall_progress_pct: number;
};
