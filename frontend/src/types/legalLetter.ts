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
  // 반성문 전용 선택사항 옵션 — 그대로 드롭다운/라디오로 렌더.
  case_stage_options: string[];
  settlement_status_options: string[];
  // 자유 서술 질문 key → 화면에 보일 라벨(순서 그대로 렌더) — 라벨은 서버가
  // 내려주는 값을 그대로 쓴다(프론트에 하드코딩 안 함).
  repentance_questions: Record<string, string>;
  petition_questions: Record<string, string>;
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
  charge: string; // 죄명 — 공통
  court_name: string; // 관할명(경찰/검찰/법원 등)
  writer_name: string;
  writer_birth: string; // YYYY-MM-DD
  // 탄원서는 생략 가능.
  writer_address?: string;
  writer_phone?: string;
  // 탄원서 전용(필수)
  defendant_name?: string; // 사건당사자 성명
  relationship?: string; // 사건당사자와의 관계
  // 반성문 전용 선택사항(필수)
  first_offense?: boolean;
  prior_same_type_record?: boolean; // first_offense=false 일 때만 필요
  case_stage?: string;
  settlement_status?: string;
  // 자유 서술 질문 key → 답변 — AI 가 이 답변을 바탕으로 본문을 작성한다.
  answers: Record<string, string>;
};
