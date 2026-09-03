"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import {
  absUrl,
  deleteMe,
  getMe,
  getMyCounselingOrders,
  getMyEnrollments,
  getMyOrders,
  getMySurvey,
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
  SurveyDetail,
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
import { CourseThumbnail } from "@/components/CourseThumbnail";

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
  const [answersSurveyId, setAnswersSurveyId] = useState<number | null>(null);
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
    <div className="mx-auto max-w-5xl space-y-8 md:space-y-12 px-4 md:px-6 py-6 md:py-12 pb-24 animate-in fade-in duration-300">
      <PageHeader
        title="마이페이지"
        subtitle="My Page"
        icon={<User className="h-3.5 w-3.5" />}
        description="수강 중인 강의와 결제·발급 내역, 계정 정보를 관리하세요."
      />

      <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-12 lg:gap-12">
        {/* Left Column (Main Content) */}
        <div className="space-y-8 md:space-y-12 lg:col-span-8">
          <Section icon={<BookOpen className="h-6 w-6 text-[var(--color-accent)]" />} title="수강 현황">
            {enrollments.length === 0 ? (
              <EmptyState
                text="현재 수강 중인 강의가 없습니다."
                cta={{ href: "/courses", label: "강의 둘러보기" }}
              />
            ) : (
              <ul className="space-y-4">
                {enrollments.map((e) => (
                  <EnrollmentRow
                    key={e.course_id}
                    enrollment={e}
                    order={orders.find((o) => o.course_id === e.course_id)}
                  />
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
                  <OrderRow
                    key={o.id}
                    order={o}
                    isCourseCompleted={
                      enrollments.find((e) => e.course_id === o.course_id)?.is_completed ?? false
                    }
                    onViewAnswers={(id) => setAnswersSurveyId(id)}
                  />
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
                  <CounselingOrderCard
                    key={co.order_id}
                    order={co}
                    onViewAnswers={(id) => setAnswersSurveyId(id)}
                  />
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
                <div className="bg-slate-50 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-200">
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
                <dl className="divide-y divide-zinc-100 p-4 sm:p-6">
                  <Field label="이메일" value={me.email} />
                  <Field
                    label="가입일"
                    value={new Date(me.created_at).toLocaleDateString("ko-KR")}
                  />
                </dl>
                <div className="border-t border-zinc-100 px-4 sm:px-6 py-3 text-right">
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
          <div className="rounded-2xl border border-[var(--color-accent)]/30 bg-blue-50/50 p-6 shadow-sm">
            <h3 className="font-bold text-[var(--color-primary)] mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" /> 문서 발급 안내
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              수료증은 강의 수료(진도+퀴즈 통과) 후, 상담 의견서는 결제 후 해당 내역에서 직접 다운로드하실 수 있습니다. 법원 제출용으로 바로 사용 가능합니다.
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
      {answersSurveyId != null ? (
        <SurveyAnswersModal
          surveyId={answersSurveyId}
          onClose={() => setAnswersSurveyId(null)}
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
    <section className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-2">
        {icon && <span className="shrink-0">{icon}</span>}
        <h2 className="font-sans text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
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

function expiryBadge(
  expiresAt: string | null,
): { label: string; className: string } | null {
  if (!expiresAt) return null;
  const diffDays = Math.ceil(
    (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays <= 0) {
    return {
      label: "수강기간 만료",
      className: "bg-red-50 text-red-600 ring-1 ring-red-500/20",
    };
  }
  if (diffDays <= 2) {
    return {
      label: `수강기간 D-${diffDays}`,
      className: "bg-amber-50 text-amber-600 ring-1 ring-amber-500/20",
    };
  }
  return null;
}

function EnrollmentRow({
  enrollment,
  order,
}: {
  enrollment: EnrollmentWithProgress;
  order?: OrderWithExtras;
}) {
  const isComplete = enrollment.is_completed;
  const issuedDoc = order?.documents?.[0];
  const progressPct = enrollment.overall_progress_pct;
  const expiry = expiryBadge(enrollment.expires_at);

  return (
    <li className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-[var(--color-primary)]/30 hover:shadow-md sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* 썸네일 (모바일에서는 가로 100%, 태블릿 이상 w-32) */}
        <div className="w-full shrink-0 overflow-hidden rounded-xl sm:w-32 sm:self-start">
          <CourseThumbnail
            category={enrollment.category}
            title={enrollment.course_title}
          />
        </div>

        {/* 우측 내용 */}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[var(--color-accent)] ring-1 ring-blue-500/20">
                  {enrollment.category}
                </span>
                {isComplete ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 ring-1 ring-emerald-500/20">
                    수료 완료
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-600 ring-1 ring-blue-500/20">
                    수강 중
                  </span>
                )}
                {expiry ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${expiry.className}`}
                  >
                    {expiry.label}
                  </span>
                ) : null}
              </div>
              <h3 className="font-sans text-base font-bold text-slate-900 leading-snug sm:text-lg">
                {enrollment.course_title}
              </h3>
            </div>

            <div className="flex items-center gap-2 mt-1 sm:mt-0 flex-wrap sm:shrink-0">
              <Link
                href={`/courses/${enrollment.course_id}/watch`}
                aria-disabled={expiry?.label === "수강기간 만료"}
                onClick={(e) => {
                  if (expiry?.label === "수강기간 만료") {
                    e.preventDefault();
                    alert(
                      "수강 기간이 만료되었습니다. 연장이 필요하시면 admin@kcpec.co.kr 로 문의해 주세요.",
                    );
                  }
                }}
                className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-[var(--color-primary)] hover:bg-slate-50 hover:text-[var(--color-primary)] shadow-sm"
              >
                <PlayCircle className="h-3.5 w-3.5" /> 이어보기
              </Link>
              {isComplete && issuedDoc ? (
                <a
                  href={absUrl(issuedDoc.pdf_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-900/10 transition-colors hover:from-blue-700 hover:to-blue-800"
                >
                  <Download className="h-3.5 w-3.5" /> 수료증 다운로드
                </a>
              ) : isComplete && order ? (
                <Link
                  href={`/issue?order_id=${order.id}`}
                  className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-900/10 transition-colors hover:from-blue-700 hover:to-blue-800"
                >
                  수료증 발급받기
                </Link>
              ) : enrollment.has_quiz ? (
                progressPct >= 100 ? (
                  <Link
                    href={`/courses/${enrollment.course_id}/quiz`}
                    className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border border-[var(--color-accent)] bg-blue-50 px-4 py-2 text-xs font-bold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-white shadow-sm"
                  >
                    퀴즈 응시
                  </Link>
                ) : (
                  <span
                    title="모든 강의를 완료해야 응시 가능합니다"
                    className="inline-flex flex-1 sm:flex-none cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold text-zinc-400"
                  >
                    퀴즈 응시
                  </span>
                )
              ) : null}
            </div>
          </div>

          {/* 진도율 한 줄: 라벨 | 바 | 퍼센트 */}
          <div className="mt-1.5 flex items-center gap-3">
            <span className="shrink-0 text-xs font-medium text-slate-500">진도율</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  isComplete
                    ? "bg-emerald-500"
                    : "bg-gradient-to-r from-[var(--color-primary)] to-blue-500"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span
              className={`w-10 shrink-0 text-right text-xs font-bold ${
                isComplete ? "text-emerald-600" : "text-[var(--color-primary)]"
              }`}
            >
              {progressPct}%
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

function OrderRow({
  order,
  isCourseCompleted,
  onViewAnswers,
}: {
  order: OrderWithExtras;
  isCourseCompleted: boolean;
  onViewAnswers: (surveyId: number) => void;
}) {
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
          {order.course_title ? (
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-sans text-base font-semibold text-slate-900">
                {order.course_title}
              </span>
            </div>
          ) : null}
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
                      수료증 <span className="text-slate-400 font-normal ml-1">({d.issue_number})</span>
                    </span>
                    {d.pdf_url && (
                      <a
                        href={absUrl(d.pdf_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white border border-zinc-200 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:border-blue-200 hover:text-[var(--color-accent)] transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" /> PDF 다운로드
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : isCourseCompleted ? (
              <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-center">
                <p className="text-xs text-slate-500 mb-3">수료 완료 — 수료증을 발급받을 수 있습니다.</p>
                <Link
                  href={`/issue?order_id=${order.id}`}
                  className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[var(--color-primary-hover)] transition-colors"
                >
                  수료증 발급하기
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-center">
                <p className="text-xs text-slate-500 mb-3">
                  강의를 완주(진도+퀴즈 통과)하면 수료증을 발급받을 수 있습니다.
                </p>
                <Link
                  href={`/courses/${order.course_id}/watch`}
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                >
                  이어서 수강하기
                </Link>
              </div>
            )}

            {/* Counseling */}
            <div className="mt-2">
              <CounselingRow order={order} onViewAnswers={onViewAnswers} />
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function CounselingRow({
  order,
  onViewAnswers,
}: {
  order: OrderWithExtras;
  onViewAnswers: (surveyId: number) => void;
}) {
  // 심리상담 설문 대상: 독립 구매(order_type=counseling) 또는 "심리상담 의견서" 강의 주문.
  const hasCounseling =
    order.order_type === "counseling" ||
    (order.course_title?.includes("심리상담") ?? false);

  // 심리상담 대상이 아닌 일반 강의 주문 → 별도 구매 유도.
  if (!hasCounseling) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-center bg-slate-50/60">
        <p className="text-xs text-slate-500 mb-3">
          심리상담 의견서가 필요하신가요? 별도로 신청하실 수 있습니다.
        </p>
        <Link
          href="/counseling"
          className="inline-flex items-center justify-center rounded-lg bg-white border border-zinc-300 px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
        >
          심리상담 의견서 추가하기
        </Link>
      </div>
    );
  }

  const survey = order.survey;
  if (!survey) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-center bg-slate-50">
        <p className="text-xs text-slate-500 mb-3">심리상담 의견서 발급을 위해 설문이 필요합니다.</p>
        <Link
          href={`/survey?order_id=${order.id}`}
          className="inline-flex items-center justify-center rounded-lg bg-white border border-zinc-300 px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
        >
          상담 설문지 작성하기
        </Link>
      </div>
    );
  }
  // 최종 발급 전이면 수정 가능 (spec: submitted / sent_to_staff)
  const editable =
    survey.status === "submitted" || survey.status === "sent_to_staff";
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50/30 p-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-slate-700">
        심리상담 의견서 <span className="mx-2 text-slate-300">|</span>
        <strong className="text-[var(--color-accent)]">
          {COUNSELING_STATUS_LABEL[survey.status as CounselingStatus]}
        </strong>
      </span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onViewAnswers(survey.id)}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          답변 보기
        </button>
        {editable ? (
          <Link
            href={`/survey?edit=${survey.id}`}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            수정하기
          </Link>
        ) : null}
        {survey.status === "completed" && survey.final_pdf_url && (
          <a
            href={absUrl(survey.final_pdf_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            <Download className="h-3.5 w-3.5" /> PDF 다운로드
          </a>
        )}
      </div>
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

function CounselingOrderCard({
  order,
  onViewAnswers,
}: {
  order: CounselingOrderItem;
  onViewAnswers: (surveyId: number) => void;
}) {
  const programLabel = COUNSELING_PROGRAM_LABEL[order.counseling_type];
  const isPaid = order.status === "paid";
  const isCompleted = order.survey_status === "completed";
  const surveySubmitted = order.survey_status != null;
  const editable =
    order.survey_status === "submitted" ||
    order.survey_status === "sent_to_staff";

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
        ) : (
          <>
            {order.survey_id != null ? (
              <button
                type="button"
                onClick={() => onViewAnswers(order.survey_id!)}
                className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                답변 보기
              </button>
            ) : null}
            {editable && order.survey_id != null ? (
              <Link
                href={`/survey?edit=${order.survey_id}`}
                className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                수정하기
              </Link>
            ) : null}
            {isCompleted && order.final_pdf_url ? (
              <a
                href={absUrl(order.final_pdf_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)]"
              >
                의견서 다운로드
              </a>
            ) : !isCompleted ? (
              <span className="rounded bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                검토 중
              </span>
            ) : null}
          </>
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

// ---------- 심리상담 답변 보기 모달 ----------------------------------------

// q2..q6 + 구버전 한글 키 → 표시 라벨
const SURVEY_QUESTION_LABELS: Record<string, string> = {
  q2: "이 사건의 내용",
  q3: "이 사건에서 가장 후회되는 점",
  q4: "이 사건으로 인해 가장 걱정되는 점",
  q5: "추후 재범하지 않기 위해 스스로 노력해야 하는 점",
  q6: "더 하고 싶은 말",
  // 구버전 데이터 호환
  사건내용: "이 사건의 내용",
  후회되는점: "이 사건에서 가장 후회되는 점",
  걱정되는점: "이 사건으로 인해 가장 걱정되는 점",
  재범방지노력: "추후 재범하지 않기 위해 스스로 노력해야 하는 점",
  하고싶은말: "더 하고 싶은 말",
  인적사항: "인적사항",
};

const SURVEY_KEY_ORDER = [
  "personal",
  "q2",
  "q3",
  "q4",
  "q5",
  "q6",
  // 구버전 호환 — 신키와 충돌하지 않도록 뒤에 위치
  "인적사항",
  "사건내용",
  "후회되는점",
  "걱정되는점",
  "재범방지노력",
  "하고싶은말",
];

const PERSONAL_LABELS: Record<string, string> = {
  name: "성명",
  gender: "성별",
  birthdate: "생년월일",
  age: "나이",
  phone: "연락처",
  job: "직업",
  education: "학력",
  family: "가족관계",
  criminal_record: "전과 유무",
  criminal_detail: "전과 내용",
  health: "건강상태",
  military: "병역",
};

const PERSONAL_KEY_ORDER = [
  "name",
  "gender",
  "birthdate",
  "age",
  "phone",
  "job",
  "education",
  "family",
  "criminal_record",
  "criminal_detail",
  "health",
  "military",
];

function SurveyAnswersModal({
  surveyId,
  onClose,
}: {
  surveyId: number;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<SurveyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMySurvey(surveyId)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => !cancelled && setError("설문을 불러오지 못했습니다."));
    return () => {
      cancelled = true;
    };
  }, [surveyId]);

  // 알려진 키부터 정해진 순서로, 그 외 키는 뒤에.
  const orderedEntries: [string, unknown][] = (() => {
    if (!detail) return [];
    const r = detail.responses;
    const known = SURVEY_KEY_ORDER.filter((k) => k in r).map(
      (k) => [k, r[k]] as [string, unknown],
    );
    const unknown = Object.entries(r).filter(
      ([k]) => !SURVEY_KEY_ORDER.includes(k),
    );
    return [...known, ...unknown];
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="font-sans text-lg font-bold text-[var(--color-primary)]">
            심리상담 설문 응답
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-900"
          >
            닫기
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : !detail ? (
            <p className="text-sm text-slate-500">불러오는 중...</p>
          ) : orderedEntries.length === 0 ? (
            <p className="text-sm text-slate-500">응답이 없습니다.</p>
          ) : (
            <dl className="divide-y divide-zinc-100">
              {orderedEntries.map(([key, value]) => (
                <div key={key} className="py-4 first:pt-0 last:pb-0">
                  <dt className="text-sm font-medium text-slate-500">
                    {key === "personal"
                      ? "인적사항"
                      : SURVEY_QUESTION_LABELS[key] ?? key}
                  </dt>
                  <dd className="mt-1.5 text-base leading-relaxed text-slate-800">
                    {key === "personal" && value && typeof value === "object" ? (
                      <PersonalSummary data={value as Record<string, unknown>} />
                    ) : (
                      <span className="whitespace-pre-wrap">
                        {String(value || "") || (
                          <span className="text-zinc-400">(빈 응답)</span>
                        )}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}

function PersonalSummary({ data }: { data: Record<string, unknown> }) {
  const entries = PERSONAL_KEY_ORDER
    .filter((k) => data[k] != null && data[k] !== "")
    .map((k) => [k, data[k]] as const);
  const extra = Object.entries(data).filter(
    ([k, v]) =>
      !PERSONAL_KEY_ORDER.includes(k) && v != null && v !== "",
  );
  const all = [...entries, ...extra];
  if (all.length === 0) {
    return <span className="text-zinc-400">(인적사항 미입력)</span>;
  }
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {all.map(([k, v]) => (
        <div key={k} className="flex gap-3 text-sm">
          <dt className="w-20 shrink-0 text-slate-500">
            {PERSONAL_LABELS[k] ?? k}
          </dt>
          <dd className="font-medium text-slate-800">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
