export type PaymentMethod =
  | "card"
  | "kakaopay"
  | "naverpay"
  | "samsungpay"
  | "mobile_phone"
  | "transfer"
  | "bank_transfer";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  card: "신용/체크카드",
  kakaopay: "카카오페이",
  naverpay: "네이버페이",
  samsungpay: "삼성페이",
  mobile_phone: "휴대폰 결제",
  transfer: "실시간 계좌이체",
  bank_transfer: "가상계좌",
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
  // 무통장입금(토스 가상계좌) 발급 정보 — 입금 대기 중일 때만 값이 있음.
  va_account_number?: string | null;
  va_bank_code?: string | null;
  va_customer_name?: string | null;
  va_due_date?: string | null;
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

export type IssuedDocumentType = "certificate" | "guide" | "cbt" | "counseling";
export type IssuedDocumentStatus = "pending" | "ready" | "revoked";

export type DocumentResponse = {
  id: number;
  document_type: IssuedDocumentType;
  issue_number: string;
  status: IssuedDocumentStatus;
  pdf_url: string | null;
  pledge_pdf_url: string | null;
  issued_at: string | null;
  downloaded_at: string | null;
};
