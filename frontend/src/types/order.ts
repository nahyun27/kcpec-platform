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
  order_type: OrderType;
  status: OrderStatus;
  amount: number;
  payment_method: PaymentMethod;
  created_at: string;
  paid_at: string | null;
  // 카드 헤더 표시용 — /orders/my 응답에서만 채워짐.
  course_title?: string | null;
  // 맞춤강의찾기 묶음결제로 같이 생성된 주문끼리 공유하는 값.
  bundle_id?: string | null;
};

export type BundleItem = {
  order_id: number;
  course_id: number;
  course_title: string;
  amount: number;
};

export type BundleCreateResponse = {
  bundle_id: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  items: BundleItem[];
};

export type IssuedDocumentType = "certificate" | "guide" | "cbt";
export type IssuedDocumentStatus = "pending" | "ready";

export type DocumentResponse = {
  id: number;
  document_type: IssuedDocumentType;
  issue_number: string;
  status: IssuedDocumentStatus;
  pdf_url: string | null;
  pledge_pdf_url: string | null;
  issued_at: string | null;
};
