export type PackageTier = "basic" | "standard" | "premium";

export type DocumentType =
  | "certificate"
  | "guide"
  | "counseling"
  | "cbt"
  | "consultation";

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  certificate: "이수증",
  guide: "양형자료 가이드",
  counseling: "심리상담 의견서",
  cbt: "CBT 자료",
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

export type OrderResponse = {
  id: number;
  course_id: number;
  package_id: number;
  status: OrderStatus;
  amount: number;
  payment_method: PaymentMethod;
  created_at: string;
  paid_at: string | null;
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
