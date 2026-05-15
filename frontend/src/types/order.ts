export type PackageTier = "basic" | "standard" | "premium";

export type DocumentType =
  | "certificate"
  | "guide"
  | "counseling"
  | "cbt"
  | "petition_sample"
  | "reflection_essay"
  | "self_reflection_report"
  | "consultation";

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  certificate: "수료증",
  guide: "양형자료 가이드",
  counseling: "심리상담 의견서",
  cbt: "CBT 자료",
  petition_sample: "탄원서 샘플",
  reflection_essay: "교육이수 소감문",
  self_reflection_report: "자기성찰리포트",
  // alembic 0016 이후 패키지에 포함되지 않음 — 레거시 데이터 표시용 라벨 유지.
  consultation: "1:1 상담",
};

export type PackageWithDocuments = {
  id: number;
  name: string;
  tier: PackageTier;
  price: number | null;
  description: string | null;
  document_types: DocumentType[];
};

export type PaymentMethod = "card" | "kakaopay" | "naverpay" | "bank_transfer";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  card: "신용/체크카드",
  kakaopay: "카카오페이",
  naverpay: "네이버페이",
  bank_transfer: "무통장 입금",
};

export type OrderStatus = "pending" | "paid" | "cancelled" | "refunded";
export type OrderType = "course" | "counseling";

export type OrderResponse = {
  id: number;
  course_id: number;
  package_id: number | null;
  order_type: OrderType;
  status: OrderStatus;
  amount: number;
  payment_method: PaymentMethod;
  created_at: string;
  paid_at: string | null;
  // 패키지에 포함된 문서 타입 — UI 분기용. /orders/my 응답에서만 채워짐.
  package_document_types?: DocumentType[];
  // 카드 헤더 표시용 — /orders/my 응답에서만 채워짐.
  course_title?: string | null;
  package_name?: string | null;
};

export type IssuedDocumentType = "certificate" | "guide" | "cbt";
export type IssuedDocumentStatus = "pending" | "ready";

export type DocumentResponse = {
  id: number;
  document_type: IssuedDocumentType;
  issue_number: string;
  status: IssuedDocumentStatus;
  pdf_url: string | null;
  issued_at: string | null;
};
