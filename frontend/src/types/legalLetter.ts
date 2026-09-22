export type LegalLetterType = "repentance" | "petition";

export const LEGAL_LETTER_LABEL: Record<LegalLetterType, string> = {
  repentance: "반성문",
  petition: "탄원서",
};

// 백엔드 hidden Course.title 과 반드시 동일해야 함
// (backend/app/api/v1/orders.py 의 REPENTANCE_LETTER_COURSE_TITLE 등).
const LEGAL_LETTER_COURSE_TITLES: Record<string, LegalLetterType> = {
  "반성문 작성": "repentance",
  "탄원서 작성": "petition",
};

export function legalLetterTypeFromCourseTitle(title: string | null | undefined): LegalLetterType | null {
  if (!title) return null;
  return LEGAL_LETTER_COURSE_TITLES[title] ?? null;
}

export type LegalLetterInfo = {
  repentance_price: number;
  petition_price: number;
};

export type LegalLetterStatus = {
  order_id: number;
  letter_type: LegalLetterType;
  course_title: string;
  amount: number;
  paid: boolean;
  submitted: boolean;
  pdf_url: string | null;
  created_at: string | null;
};

export type LegalLetterSubmitPayload = {
  case_number?: string;
  charge_or_defendant: string;
  court_name: string;
  writer_name: string;
  writer_birth: string; // YYYY-MM-DD
  writer_address: string;
  writer_phone: string;
  relationship?: string; // 탄원서만 필수
  content: string;
};
