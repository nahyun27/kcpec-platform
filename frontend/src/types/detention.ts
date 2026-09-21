import type { OrderStatus, PaymentMethod } from "@/types/order";

export type DetentionStatus = "received" | "materials_sent" | "completed" | "cancelled";

export const DETENTION_STATUS_LABEL: Record<DetentionStatus, string> = {
  received: "접수(자료 발송 대기)",
  materials_sent: "자료 발송 완료(회신 대기)",
  completed: "수료증 발송 완료",
  cancelled: "취소",
};

export type DetentionCourse = {
  id: number;
  title: string;
  price: number;
  category: string;
};

export type DetentionInfo = {
  fee_amount: number;
  courses: DetentionCourse[];
  bulk_discount_threshold: number;
  bulk_discount_amount: number;
};

export type DetentionApplyPayload = {
  course_ids: number[];
  payment_method: PaymentMethod;
  inmate_name: string;
  inmate_birth: string;
  inmate_number: string;
  facility_name: string;
  postal_code?: string;
  address: string;
  delivery_note?: string;
  contact_phone: string;
  certificate_email: string;
  agree_privacy: boolean;
};

export type AdminDetentionOrder = {
  order_id: number;
  course_title: string;
  amount: number;
  status: OrderStatus;
  is_fee: boolean;
  document_id: number | null;
  issue_number: string | null;
  pdf_url: string | null;
  pledge_pdf_url: string | null;
};

export type AdminDetentionRow = {
  id: number;
  status: DetentionStatus;
  created_at: string;
  buyer_username: string;
  buyer_email: string;
  inmate_name: string;
  inmate_birth: string;
  inmate_number: string;
  facility_name: string;
  postal_code: string | null;
  address: string;
  delivery_note: string | null;
  contact_phone: string;
  certificate_email: string;
  tracking_number: string | null;
  admin_memo: string | null;
  materials_sent_at: string | null;
  completed_at: string | null;
  paid: boolean;
  total: number;
  orders: AdminDetentionOrder[];
};
