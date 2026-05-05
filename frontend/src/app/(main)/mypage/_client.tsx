"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import {
  deleteMe,
  getMe,
  getMyCounselingOrders,
  getMyEnrollments,
  getMyOrders,
  getOrderDocuments,
  getSurveyStatus,
  tokenStorage,
  updateMe,
  type UserResponse,
} from "@/lib/api";
import type {
  CounselingOrderItem,
  CounselingStatus,
  EnrollmentWithProgress,
  SurveyStatusResponse,
} from "@/types/counseling";
import {
  COUNSELING_PROGRAM_LABEL,
  COUNSELING_STATUS_LABEL,
} from "@/types/counseling";
import {
  PAYMENT_METHOD_LABEL,
  type DocumentResponse,
  type OrderResponse,
} from "@/types/order";
import { BookOpen, CreditCard, Download, FileText, User, ChevronRight, PlayCircle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

type OrderWithExtras = OrderResponse & {
  documents: DocumentResponse[];
  survey?: SurveyStatusResponse | null;
};

export default function MyPageClient() {
  const router = useRouter();
  const [me, setMe] = useState<UserResponse | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentWithProgress[]>([]);
  const [orders, setOrders] = useState<OrderWithExtras[]>([]);
  const [counselingOrders, setCounselingOrders] = useState<CounselingOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast == null) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!tokenStorage.getAccess()) {
      router.replace("/login?next=/mypage");
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const [u, e, o, co] = await Promise.all([
          getMe(),
          getMyEnrollments(),
          getMyOrders(),
          getMyCounselingOrders().catch(() => [] as CounselingOrderItem[]),
        ]);
        if (cancelled) return;
        setMe(u);
        setEnrollments(e);
        setCounselingOrders(co);

        // 패키지 주문(course) 만 documents/survey enrich. 심리상담 독립 주문은 별도 섹션.
        const enriched = await Promise.all(
          o
            .filter((order) => order.order_type !== "counseling")
            .map(async (order) => {
              const [docs, survey] = await Promise.all([
                getOrderDocuments(order.id).catch(() => [] as DocumentResponse[]),
                getSurveyStatus(order.id).catch(() => null),
              ]);
              return { ...order, documents: docs, survey };
            }),
        );
        if (!cancelled) setOrders(enriched);
      } catch (err) {
        if (cancelled) return;
        if (isAxiosError(err) && err.response?.status === 401) {
          tokenStorage.clear();
          router.replace("/login?next=/mypage");
          return;
        }
        setError("정보를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[var(--color-accent)]" />
          <p className="text-sm font-medium text-slate-500">정보를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-600 shadow-sm">
          <p className="text-lg font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-6 py-12 pb-24">
      <PageHeader
        title="마이페이지"
        subtitle="My Page"
        icon={<User className="h-3.5 w-3.5" />}
        description="수강 중인 강의와 결제·발급 내역, 계정 정보를 관리하세요."
      />

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        {/* Left Column (Main Content) */}
        <div className="space-y-12 lg:col-span-8">
          <Section icon={<BookOpen className="h-6 w-6 text-[var(--color-accent)]" />} title="수강 현황">
            {enrollments.length === 0 ? (
              <EmptyState
                text="현재 수강 중인 강의가 없습니다."
                cta={{ href: "/courses", label: "무료 강의 둘러보기" }}
              />
            ) : (
              <ul className="space-y-4">
                {enrollments.map((e) => (
                  <EnrollmentRow key={e.course_id} enrollment={e} />
                ))}
              </ul>
            )}
          </Section>

          <Section icon={<CreditCard className="h-6 w-6 text-[var(--color-accent)]" />} title="결제 · 발급 내역">
            {orders.length === 0 ? (
              <EmptyState text="결제 내역이 존재하지 않습니다." />
            ) : (
              <ul className="space-y-4">
                {orders.map((o) => (
                  <OrderRow key={o.id} order={o} />
                ))}
              </ul>
            )}
          </Section>

          <Section
            icon={<FileText className="h-6 w-6 text-[var(--color-accent)]" />}
            title="심리상담 내역"
          >
            {counselingOrders.length === 0 ? (
              <EmptyState
                text="심리상담 신청 내역이 없습니다."
                cta={{ href: "/counseling", label: "심리상담 알아보기" }}
              />
            ) : (
              <ul className="space-y-4">
                {counselingOrders.map((co) => (
                  <CounselingOrderCard key={co.order_id} order={co} />
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* Right Column (Sidebar) */}
        <div className="lg:col-span-4 space-y-6">
          <Section icon={<User className="h-6 w-6 text-[var(--color-accent)]" />} title="계정 정보">
            {me ? (
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <div className="bg-slate-50 px-6 py-4 border-b border-zinc-200">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-white font-bold">
                      {me.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{me.username}</p>
                      <p className="text-xs text-slate-500">
                        {me.social_provider
                          ? `${me.social_provider === "kakao" ? "카카오" : me.social_provider === "naver" ? "네이버" : me.social_provider} 회원`
                          : "일반 회원"}
                      </p>
                    </div>
                  </div>
                </div>
                <dl className="divide-y divide-zinc-100 p-6">
                  <Field label="이메일" value={me.email} />
                  <Field
                    label="가입일"
                    value={new Date(me.created_at).toLocaleDateString("ko-KR")}
                  />
                </dl>
                <div className="border-t border-zinc-100 px-6 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="text-xs font-semibold text-[var(--color-primary)] underline-offset-4 hover:underline"
                  >
                    이메일 / 비밀번호 수정
                  </button>
                </div>
                <DeactivateRow isSocial={me.social_provider !== null} />
              </div>
            ) : null}
          </Section>

          {/* Quick Help Card */}
          <div className="rounded-2xl border border-[var(--color-accent)]/30 bg-teal-50/50 p-6 shadow-sm">
            <h3 className="font-bold text-[var(--color-primary)] mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" /> 문서 발급 안내
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              수료증 및 상담 의견서는 결제 후 해당 내역에서 직접 다운로드하실 수 있습니다. 법원 제출용으로 바로 사용 가능합니다.
            </p>
            <Link href="/#faq" className="text-sm font-semibold text-[var(--color-accent)] hover:underline inline-flex items-center">
              자주 묻는 질문 보기 <ChevronRight className="h-4 w-4 ml-0.5" />
            </Link>
          </div>
        </div>
      </div>

      {editOpen && me ? (
        <EditProfileModal
          me={me}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setMe(updated);
            setEditOpen(false);
            setToast("정보가 수정되었습니다");
          }}
        />
      ) : null}
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-sans text-2xl font-bold text-slate-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyState({
  text,
  cta,
}: {
  text: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white/50 py-16 text-center text-slate-500 shadow-sm">
      <BookOpen className="mb-4 h-10 w-10 text-slate-300" />
      <p className="text-base font-medium">{text}</p>
      {cta ? (
        <Link
          href={cta.href}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] hover:shadow-lg hover:shadow-[var(--color-primary)]/20"
        >
          {cta.label}
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}

function EnrollmentRow({ enrollment }: { enrollment: EnrollmentWithProgress }) {
  const isComplete = enrollment.is_completed;
  const progressPct = enrollment.overall_progress_pct;

  return (
    <li className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:border-[var(--color-primary)]/30 hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold tracking-wide text-[var(--color-accent)] ring-1 ring-teal-500/20">
              {enrollment.category}
            </span>
            {isComplete ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600 ring-1 ring-emerald-500/20">
                수료 완료
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-600 ring-1 ring-blue-500/20">
                수강 중
              </span>
            )}
          </div>
          <h3 className="font-sans text-xl font-bold text-slate-900 line-clamp-1">
            {enrollment.course_title}
          </h3>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:mt-0 mt-4">
          <Link
            href={`/courses/${enrollment.course_id}/watch`}
            className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:border-[var(--color-primary)] hover:bg-slate-50 hover:text-[var(--color-primary)]"
          >
            <PlayCircle className="h-4 w-4" /> 이어보기
          </Link>
          {isComplete ? (
            <Link
              href={`/checkout?course_id=${enrollment.course_id}`}
              className="flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--color-primary-hover)]"
            >
              수료증 결제
            </Link>
          ) : enrollment.has_quiz ? (
            progressPct >= 100 ? (
              <Link
                href={`/courses/${enrollment.course_id}/quiz`}
                className="flex items-center gap-1.5 rounded-full border border-[var(--color-accent)] bg-teal-50 px-4 py-2 text-sm font-bold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-white"
              >
                퀴즈 응시
              </Link>
            ) : (
              <span
                title="모든 강의를 완료해야 응시 가능합니다"
                className="flex cursor-not-allowed items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-bold text-zinc-400"
              >
                퀴즈 응시
              </span>
            )
          ) : null}
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-slate-50 p-4">
        <div className="flex items-end justify-between text-sm mb-2">
          <span className="font-bold text-slate-700">진도율</span>
          <span className="text-xl font-extrabold text-[var(--color-accent)]">
            {progressPct}%
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-teal-400 to-[var(--color-accent)]'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </li>
  );
}

function OrderRow({ order }: { order: OrderWithExtras }) {
  const isPaid = order.status === "paid";
  
  return (
    <li className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="flex flex-col gap-4 border-b border-zinc-100 bg-slate-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-slate-500">주문번호 #{order.id}</span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500">{new Date(order.created_at).toLocaleString("ko-KR")}</span>
          </div>
          <p className="font-sans text-lg font-bold text-slate-900">
            {order.amount.toLocaleString()}원 <span className="text-sm font-medium text-slate-500 ml-1">({PAYMENT_METHOD_LABEL[order.payment_method]})</span>
          </p>
        </div>
        <div className="self-start sm:self-center">
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      {isPaid ? (
        <div className="p-5 bg-white">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--color-primary)]" />
            <h4 className="font-bold text-slate-800">발급 서류 및 상담 현황</h4>
          </div>
          
          <div className="space-y-3">
            {/* Documents */}
            {order.documents.length > 0 ? (
              <ul className="space-y-2">
                {order.documents.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-slate-50 p-3"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      이수증 <span className="text-slate-400 font-normal ml-1">({d.issue_number})</span>
                    </span>
                    {d.pdf_url && (
                      <a
                        href={d.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white border border-zinc-200 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:border-teal-200 hover:text-[var(--color-accent)] transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" /> PDF 다운로드
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-center">
                <p className="text-xs text-slate-500 mb-3">아직 발급된 이수증이 없습니다.</p>
                <Link
                  href={`/issue?order_id=${order.id}`}
                  className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[var(--color-primary-hover)] transition-colors"
                >
                  이수증 즉시 발급하기
                </Link>
              </div>
            )}

            {/* Counseling */}
            <div className="mt-2">
              <CounselingRow order={order} />
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function CounselingRow({ order }: { order: OrderWithExtras }) {
  const survey = order.survey;
  if (!survey) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-center bg-slate-50">
        <p className="text-xs text-slate-500 mb-3">심리상담 의견서(패키지 포함 시) 발급을 위해 설문이 필요합니다.</p>
        <Link
          href={`/survey?order_id=${order.id}`}
          className="inline-flex items-center justify-center rounded-lg bg-white border border-zinc-300 px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
        >
          상담 설문지 작성하기
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-teal-100 bg-teal-50/30 p-3">
      <span className="text-sm font-medium text-slate-700">
        심리상담 의견서 <span className="mx-2 text-slate-300">|</span> 
        <strong className="text-[var(--color-accent)]">{COUNSELING_STATUS_LABEL[survey.status as CounselingStatus]}</strong>
      </span>
      {survey.status === "completed" && survey.final_pdf_url && (
        <a
          href={survey.final_pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> PDF 다운로드
        </a>
      )}
    </div>
  );
}

function OrderStatusBadge({ status }: { status: OrderResponse["status"] }) {
  const map: Record<OrderResponse["status"], { label: string; className: string }> = {
    paid: { label: "결제 완료", className: "bg-emerald-100 text-emerald-700 ring-emerald-500/20" },
    pending: { label: "결제 대기", className: "bg-amber-100 text-amber-700 ring-amber-500/20" },
    cancelled: { label: "취소", className: "bg-zinc-100 text-zinc-600 ring-zinc-500/20" },
    refunded: { label: "환불", className: "bg-zinc-100 text-zinc-600 ring-zinc-500/20" },
  };
  const { label, className } = map[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${className}`}>
      {label}
    </span>
  );
}

function CounselingOrderCard({ order }: { order: CounselingOrderItem }) {
  const programLabel = COUNSELING_PROGRAM_LABEL[order.counseling_type];
  const isPaid = order.status === "paid";
  const isCompleted = order.survey_status === "completed";
  const surveySubmitted = order.survey_status != null;

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500">상담 #{order.order_id}</p>
          <p className="font-sans text-base font-semibold text-slate-900">
            {programLabel}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {new Date(order.created_at).toLocaleString("ko-KR")} ·{" "}
            {order.amount > 0 ? `${order.amount.toLocaleString()}원` : "별도문의"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
              isPaid
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {isPaid ? "결제완료" : "대기중"}
          </span>
          {surveySubmitted ? (
            <span className="text-xs text-slate-500">
              설문: {COUNSELING_STATUS_LABEL[order.survey_status as CounselingStatus]}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!surveySubmitted ? (
          isPaid ? (
            <Link
              href={`/survey?counseling_order_id=${order.order_id}`}
              className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)]"
            >
              설문 작성하기
            </Link>
          ) : (
            <span className="text-xs text-slate-500">
              결제 완료 후 설문 작성이 가능합니다.
            </span>
          )
        ) : isCompleted && order.final_pdf_url ? (
          <a
            href={order.final_pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)]"
          >
            의견서 다운로드
          </a>
        ) : (
          <span className="rounded bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            검토 중
          </span>
        )}
      </div>
    </li>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3 flex justify-between items-center text-sm">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function EditProfileModal({
  me,
  onClose,
  onSaved,
}: {
  me: UserResponse;
  onClose: () => void;
  onSaved: (updated: UserResponse) => void;
}) {
  const isSocial = me.social_provider !== null;
  const [email, setEmail] = useState(me.email);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);

    const wantsPwChange = newPw.length > 0 || confirmPw.length > 0;
    if (wantsPwChange) {
      if (isSocial) {
        setError("소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.");
        return;
      }
      if (newPw.length < 8) {
        setError("새 비밀번호는 8자 이상이어야 합니다.");
        return;
      }
      if (newPw !== confirmPw) {
        setError("새 비밀번호가 일치하지 않습니다.");
        return;
      }
      if (!currentPw) {
        setError("현재 비밀번호를 입력해 주세요.");
        return;
      }
    }

    const payload: {
      email?: string;
      current_password?: string;
      new_password?: string;
    } = {};
    if (email !== me.email) payload.email = email;
    if (wantsPwChange) {
      payload.current_password = currentPw;
      payload.new_password = newPw;
    }
    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateMe(payload);
      onSaved(updated);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "수정에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-sans text-lg font-bold text-slate-900">계정 정보 수정</h2>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-800">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </div>

          {!isSocial ? (
            <div className="space-y-3 border-t border-zinc-200 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                비밀번호 변경 (선택)
              </p>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-800">
                  현재 비밀번호
                </label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  autoComplete="current-password"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-800">
                  새 비밀번호
                </label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoComplete="new-password"
                  placeholder="8자 이상"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-800">
                  새 비밀번호 확인
                </label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  autoComplete="new-password"
                  className={inputCls}
                />
              </div>
            </div>
          ) : (
            <p className="rounded border border-zinc-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.
            </p>
          )}

          {error ? (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded border border-zinc-300 px-4 py-2 text-sm text-slate-700 hover:bg-zinc-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {submitting ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeactivateRow({ isSocial }: { isSocial: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await deleteMe(isSocial ? undefined : password);
      router.push("/");
      router.refresh();
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "탈퇴에 실패했습니다.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="border-t border-zinc-100 px-6 py-3 text-right">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-red-600 underline-offset-4 hover:underline"
        >
          회원탈퇴
        </button>
      </div>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-sans text-lg font-bold text-slate-900">
              정말 탈퇴하시겠습니까?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              탈퇴 시 수강 내역 및 발급 문서에 접근할 수 없습니다.
              <br />
              계정은 비활성화 처리되며, 동일 아이디로 재가입할 수 없습니다.
            </p>

            {!isSocial ? (
              <div className="mt-5 space-y-1.5">
                <label className="block text-sm font-medium text-slate-800">
                  비밀번호 확인
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                />
              </div>
            ) : null}

            {error ? (
              <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="rounded border border-zinc-300 px-4 py-2 text-sm text-slate-700 hover:bg-zinc-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting || (!isSocial && !password)}
                className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {submitting ? "처리 중..." : "탈퇴하기"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
