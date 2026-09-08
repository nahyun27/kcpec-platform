"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import {
  absUrl,
  cancelMyOrder,
  deleteMe,
  getMe,
  getMyCounselingOrders,
  getMyEnrollments,
  getMyOrders,
  getMySurvey,
  getOrderDocuments,
  getSurveyStatus,
  resendVerification,
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
import { BookOpen, Check, CreditCard, Download, FileText, User, ChevronRight, PlayCircle, Loader2, MailWarning } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { useDialog } from "@/components/ui/DialogProvider";

type OrderWithExtras = OrderResponse & {
  documents: DocumentResponse[];
  survey?: SurveyStatusResponse | null;
};

type TabKey = "courses" | "counseling" | "orders";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "courses", label: "내 강의실", icon: <BookOpen className="h-4 w-4" /> },
  { key: "counseling", label: "전문가 심리상담", icon: <FileText className="h-4 w-4" /> },
  { key: "orders", label: "결제 내역", icon: <CreditCard className="h-4 w-4" /> },
];

function isTabKey(s: string | null): s is TabKey {
  return s === "courses" || s === "counseling" || s === "orders";
}

export default function MyPageClient() {
  const dialog = useDialog();
  const router = useRouter();
  const search = useSearchParams();
  const tabParam = search.get("tab");
  const tab: TabKey = isTabKey(tabParam) ? tabParam : "courses";
  function setTab(next: TabKey) {
    const params = new URLSearchParams(search.toString());
    params.set("tab", next);
    router.replace(`/mypage?${params.toString()}`, { scroll: false });
  }
  const [me, setMe] = useState<UserResponse | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentWithProgress[]>([]);
  // 만료된 수강은 목록 맨 아래로 — 그 외 순서는 유지 (stable sort).
  // 심리상담은 결제 시 다른 강의와 동일하게 enrollment 가 생성되지만
  // (진도 추적용 lecture 가 없는 상담 "상품"이라) 여기 강의실 목록에
  // 뜨면 진도율 0%/이어보기 같은 의미 없는 UI가 나온다 — 제외하고
  // "전문가 심리상담" 탭에서만 상태를 보여준다.
  const sortedEnrollments = useMemo(
    () =>
      [...enrollments]
        .filter((e) => e.category !== "심리상담")
        .sort((a, b) => {
          const aExpired = expiryBadge(a.expires_at)?.label === "수강기간 만료";
          const bExpired = expiryBadge(b.expires_at)?.label === "수강기간 만료";
          return aExpired === bExpired ? 0 : aExpired ? 1 : -1;
        }),
    [enrollments],
  );
  const [orders, setOrders] = useState<OrderWithExtras[]>([]);
  // 무통장입금 대기(실제 입금을 기다리는 상태)만 노출하고, 카드/카카오페이/
  // 네이버페이로 결제 시도했다가 중단·실패한 뒤 영구히 "대기중"으로 남는
  // 재시도 불가 주문은 목록에서 숨긴다.
  const visibleOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.status !== "pending" || o.payment_method === "bank_transfer",
      ),
    [orders],
  );
  // 맞춤강의찾기 묶음결제로 같이 생성된 주문(같은 bundle_id)은 주문번호/
  // 날짜만 다를 뿐 사실상 하나의 결제라, 카드 하나로 묶어서 보여준다.
  type OrderDisplayGroup =
    | { kind: "solo"; order: OrderWithExtras }
    | { kind: "bundle"; bundleId: string; orders: OrderWithExtras[] };
  const orderGroups = useMemo<OrderDisplayGroup[]>(() => {
    const seen = new Set<string>();
    const groups: OrderDisplayGroup[] = [];
    for (const o of visibleOrders) {
      if (o.bundle_id) {
        if (seen.has(o.bundle_id)) continue;
        seen.add(o.bundle_id);
        const siblings = visibleOrders.filter((x) => x.bundle_id === o.bundle_id);
        if (siblings.length > 1) {
          groups.push({ kind: "bundle", bundleId: o.bundle_id, orders: siblings });
          continue;
        }
      }
      groups.push({ kind: "solo", order: o });
    }
    return groups;
  }, [visibleOrders]);
  const [counselingOrders, setCounselingOrders] = useState<CounselingOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [answersSurveyId, setAnswersSurveyId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  async function handleCancelOrder(orderId: number) {
    if (
      !(await dialog.confirm(
        "이 주문을 취소하시겠습니까? 같은 묶음으로 함께 결제하신 다른 강의가 있다면 함께 취소됩니다.",
      ))
    ) {
      return;
    }
    try {
      await cancelMyOrder(orderId);
      const refreshed = await getMyOrders();
      setOrders((prev) =>
        refreshed
          .filter((o) => o.order_type !== "counseling")
          .map((o) => {
            const existing = prev.find((p) => p.id === o.id);
            // 이미 결제완료였던 주문은 documents/survey 를 다시 불러올 필요 없이
            // 갖고 있던 값을 유지 — 취소는 pending 상태에서만 가능하므로
            // 여기서 실제로 갈아끼워지는 건 방금 취소된 주문들뿐이다.
            return existing && existing.status === "paid"
              ? { ...existing, ...o }
              : { ...o, documents: [], survey: null };
          }),
      );
      setToast("주문이 취소되었습니다.");
    } catch {
      setToast("취소에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  async function handleResendVerification() {
    setResending(true);
    try {
      await resendVerification();
      setToast("인증 메일을 다시 보냈습니다. 메일함을 확인해 주세요.");
    } catch {
      setToast("발송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setResending(false);
    }
  }

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

        // 강의 주문(course)만 documents/survey enrich. 심리상담 독립 주문은 별도 섹션.
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
    <div className="min-h-screen bg-slate-50/50 pb-24 animate-in fade-in duration-300">
      <div className="bg-white pt-10 md:pt-16 relative z-10 border-b border-slate-100">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <PageHeader
            title="마이페이지"
            subtitle="My Page"
            icon={<User className="h-3.5 w-3.5" />}
            description="수강 중인 강의와 결제·발급 내역, 계정 정보를 관리하세요."
          />
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-8 md:space-y-12 px-4 md:px-6 pt-8 md:pt-12">
      {me && !me.is_verified ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <MailWarning className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>{me.email}</strong> 이메일 인증이 아직 안 됐어요. 수료증·심리상담
              의견서가 이 주소로 발송되니 인증을 완료해 주세요.
            </span>
          </div>
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resending}
            className="shrink-0 rounded-full bg-amber-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-60"
          >
            {resending ? "발송 중..." : "인증 메일 재발송"}
          </button>
        </div>
      ) : null}

      {/* 탭 네비게이션 */}
      <div className="hide-scrollbar -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="inline-flex w-max gap-1 rounded-full bg-slate-100/80 p-1 shadow-inner sm:w-auto sm:gap-1.5 border border-slate-200/60">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 sm:gap-2 sm:px-6 sm:py-2.5 ${
                  active
                    ? "bg-white text-[var(--color-primary)] shadow-md ring-1 ring-black/5 scale-[1.02]"
                    : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-12 lg:gap-12">
        {/* Left Column (Main Content) — 탭에 따라 섹션 하나만 노출 */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out lg:col-span-8">
          {tab === "courses" ? (
            <Section icon={<BookOpen className="h-6 w-6 text-[var(--color-accent)]" />} title="내 강의실">
              {enrollments.length === 0 ? (
                <EmptyState
                  text="현재 수강 중인 강의가 없습니다."
                  cta={{ href: "/courses", label: "강의 둘러보기" }}
                />
              ) : (
                <ul className="space-y-4">
                  {sortedEnrollments.map((e) => (
                    <EnrollmentRow
                      key={e.course_id}
                      enrollment={e}
                      order={orders.find((o) => o.course_id === e.course_id)}
                    />
                  ))}
                </ul>
              )}
            </Section>
          ) : null}

          {tab === "counseling" ? (
            <Section
              icon={<FileText className="h-6 w-6 text-[var(--color-accent)]" />}
              title="전문가 심리상담"
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
          ) : null}

          {tab === "orders" ? (
            <Section icon={<CreditCard className="h-6 w-6 text-[var(--color-accent)]" />} title="결제 내역">
              {/* 카드/카카오페이/네이버페이는 결제창을 닫거나 실패해도 주문이
                  "대기중" 상태로 영구히 남는데, 재시도/취소 수단이 없어
                  사용자 입장에선 아무 의미 없는 죽은 행이다. 무통장입금
                  대기(진짜 입금을 기다리는 상태)만 남기고 감춘다. */}
              {visibleOrders.length === 0 ? (
                <EmptyState text="결제 내역이 존재하지 않습니다." />
              ) : (
                <ul className="space-y-4">
                  {orderGroups.map((g) =>
                    g.kind === "bundle" ? (
                      <BundleOrderGroup
                        key={g.bundleId}
                        orders={g.orders}
                        enrollments={enrollments}
                        onViewAnswers={(id) => setAnswersSurveyId(id)}
                        onCancel={handleCancelOrder}
                      />
                    ) : (
                      <OrderRow
                        key={g.order.id}
                        order={g.order}
                        isCourseCompleted={
                          enrollments.find((e) => e.course_id === g.order.course_id)
                            ?.is_completed ?? false
                        }
                        onViewAnswers={(id) => setAnswersSurveyId(id)}
                        onCancel={handleCancelOrder}
                      />
                    ),
                  )}
                </ul>
              )}
            </Section>
          ) : null}
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
  const dialog = useDialog();
  const isComplete = enrollment.is_completed;
  const issuedDoc = order?.documents?.[0];
  const progressPct = enrollment.overall_progress_pct;
  const expiry = expiryBadge(enrollment.expires_at);
  // 진도 0%(아직 한 번도 안 본 상태)면 "이어보기"가 어색하므로 시작하기로
  // 문구를 구분한다. 진도가 있으면 기존처럼 다음 이어볼 차시명을 보여줌.
  const notStarted = progressPct === 0;
  const continueLabel = isComplete
    ? "다시보기"
    : notStarted
      ? "수강 시작하기"
      : enrollment.current_lecture_title
        ? `${enrollment.current_lecture_title} 이어보기`
        : "이어보기";

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
                    void dialog.alert(
                      "수강 기간이 만료되었습니다. 연장이 필요하시면 admin@kcpec.co.kr 로 문의해 주세요.",
                    );
                  }
                }}
                className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-[var(--color-primary)] hover:bg-slate-50 hover:text-[var(--color-primary)] shadow-sm"
              >
                <PlayCircle className="h-3.5 w-3.5" /> {continueLabel}
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
                    aria-disabled={expiry?.label === "수강기간 만료"}
                    onClick={(e) => {
                      if (expiry?.label === "수강기간 만료") {
                        e.preventDefault();
                        void dialog.alert(
                          "수강 기간이 만료되었습니다. 연장이 필요하시면 admin@kcpec.co.kr 로 문의해 주세요.",
                        );
                      }
                    }}
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
          {!isComplete && enrollment.total_lectures > 0 ? (
            <p className="text-xs text-slate-500">
              {enrollment.completed_lectures} / {enrollment.total_lectures}차시 완료
              {enrollment.current_lecture_title ? (
                <>
                  {" · "}
                  <span className="font-semibold text-[var(--color-primary)]">
                    {enrollment.current_lecture_title}
                  </span>{" "}
                  진행 중
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function OrderRow({
  order,
  isCourseCompleted,
  onViewAnswers,
  onCancel,
}: {
  order: OrderWithExtras;
  isCourseCompleted: boolean;
  onViewAnswers: (surveyId: number) => void;
  onCancel: (orderId: number) => void;
}) {
  const isPaid = order.status === "paid";
  const isPendingBankTransfer =
    order.status === "pending" && order.payment_method === "bank_transfer";

  return (
    <li className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="flex flex-col gap-4 border-b border-zinc-100 bg-slate-50/50 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
            <span className="font-medium">주문번호 #{order.id}</span>
            <span>•</span>
            <span>{new Date(order.created_at).toLocaleString("ko-KR")}</span>
          </div>
          {order.course_title ? (
            <p className="mb-2 font-sans text-lg font-bold text-slate-900">
              {order.course_title}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <span className="font-sans text-2xl font-black text-slate-900">
              {order.amount.toLocaleString()}
              <span className="ml-0.5 text-base font-bold text-slate-500">원</span>
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
              {PAYMENT_METHOD_LABEL[order.payment_method]}
            </span>
          </div>
        </div>
        <div className="self-start sm:self-center">
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      {isPaid ? (
        <div className="p-6 bg-white">
          <OrderPaidDetails
            order={order}
            isCourseCompleted={isCourseCompleted}
            onViewAnswers={onViewAnswers}
          />
        </div>
      ) : isPendingBankTransfer ? (
        <div className="flex flex-col gap-3 p-6 bg-white sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-slate-500">
            입금 확인이 완료되면 자동으로 강의가 열립니다. 아직 입금 전이거나 실수로
            신청하셨다면 아래에서 주문을 취소할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={() => onCancel(order.id)}
            className="shrink-0 rounded-lg border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-600 shadow-sm transition-colors hover:bg-red-50"
          >
            주문 취소
          </button>
        </div>
      ) : null}
    </li>
  );
}

function OrderPaidDetails({
  order,
  isCourseCompleted,
  onViewAnswers,
}: {
  order: OrderWithExtras;
  isCourseCompleted: boolean;
  onViewAnswers: (surveyId: number) => void;
}) {
  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-5 w-5 text-[var(--color-primary)]" />
        <h4 className="text-base font-bold text-slate-800">발급 서류 및 상담 현황</h4>
      </div>

      <div className="space-y-3">
        {order.documents.length > 0 ? (
          <ul className="space-y-2">
            {order.documents.map((d) => (
              <li
                key={d.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-slate-50 p-4"
              >
                <span className="text-sm font-bold text-slate-700">
                  수료증{" "}
                  <span className="font-normal text-slate-400">({d.issue_number})</span>
                </span>
                {d.pdf_url && (
                  <a
                    href={absUrl(d.pdf_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm hover:border-blue-200 hover:text-[var(--color-accent)] transition-colors"
                  >
                    <Download className="h-4 w-4" /> PDF 다운로드
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : isCourseCompleted ? (
          <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-center">
            <p className="text-sm text-slate-500 mb-3">수료 완료 — 수료증을 발급받을 수 있습니다.</p>
            <Link
              href={`/issue?order_id=${order.id}`}
              className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              수료증 발급하기
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-center">
            <p className="text-sm text-slate-500 mb-3">
              강의를 완주(진도+퀴즈 통과)하면 수료증을 발급받을 수 있습니다.
            </p>
            <Link
              href={`/courses/${order.course_id}/watch`}
              className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
            >
              이어서 수강하기
            </Link>
          </div>
        )}

        <div className="mt-2">
          <CounselingRow order={order} onViewAnswers={onViewAnswers} />
        </div>
      </div>
    </>
  );
}

// 맞춤강의찾기 묶음결제로 같이 생성된 주문(같은 bundle_id)을 카드 하나로
// 묶어 보여준다 — 주문번호/날짜가 갈라져 각자 다른 결제처럼 보이던 문제.
function BundleOrderGroup({
  orders,
  enrollments,
  onViewAnswers,
  onCancel,
}: {
  orders: OrderWithExtras[];
  enrollments: EnrollmentWithProgress[];
  onViewAnswers: (surveyId: number) => void;
  onCancel: (orderId: number) => void;
}) {
  const first = orders[0];
  const isPaid = first.status === "paid";
  const isPendingBankTransfer =
    first.status === "pending" && first.payment_method === "bank_transfer";
  const totalAmount = orders.reduce((sum, o) => sum + o.amount, 0);
  const orderIdsLabel = orders.map((o) => `#${o.id}`).join(", ");

  return (
    <li className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="flex flex-col gap-4 border-b border-zinc-100 bg-slate-50/50 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
            <span className="rounded-full bg-[var(--color-primary)]/10 px-2.5 py-0.5 text-xs font-bold text-[var(--color-primary)]">
              묶음결제
            </span>
            <span className="font-medium">{orderIdsLabel}</span>
            <span>•</span>
            <span>{new Date(first.created_at).toLocaleString("ko-KR")}</span>
          </div>
          <ul className="mb-3 space-y-1.5">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                <span className="font-sans text-base font-bold text-slate-900">
                  {o.course_title}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <span className="font-sans text-2xl font-black text-slate-900">
              {totalAmount.toLocaleString()}
              <span className="ml-0.5 text-base font-bold text-slate-500">원</span>
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
              {PAYMENT_METHOD_LABEL[first.payment_method]} · {orders.length}건
            </span>
          </div>
        </div>
        <div className="self-start sm:self-center">
          <OrderStatusBadge status={first.status} />
        </div>
      </div>

      {isPaid ? (
        <div className="divide-y divide-zinc-100">
          {orders.map((o) => (
            <div key={o.id} className="p-6 bg-white">
              <p className="mb-3 text-base font-bold text-slate-800">{o.course_title}</p>
              <OrderPaidDetails
                order={o}
                isCourseCompleted={
                  enrollments.find((e) => e.course_id === o.course_id)?.is_completed ?? false
                }
                onViewAnswers={onViewAnswers}
              />
            </div>
          ))}
        </div>
      ) : isPendingBankTransfer ? (
        <div className="flex flex-col gap-3 p-6 bg-white sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-slate-500">
            입금 확인이 완료되면 묶음 전체 강의가 한 번에 자동으로 열립니다. 아직
            입금 전이거나 실수로 신청하셨다면 아래에서 묶음 전체를 취소할 수
            있습니다.
          </p>
          <button
            type="button"
            onClick={() => onCancel(first.id)}
            className="shrink-0 rounded-lg border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-600 shadow-sm transition-colors hover:bg-red-50"
          >
            묶음 전체 취소
          </button>
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
  // 이 주문에 실제로 연결된 설문이 있으면(상담이 진행/완료된 것) 항상 그 상태를
  // 보여준다. (예전엔 order.course_title 에 "심리상담"이라는 문자열이 들어있는지로
  // 판단했는데, 실제 상담 상품명은 "기본 프로그램"/"전화 심화상담"/"대면 심화상담"
  // 이라 이 문자열이 애초에 매치된 적이 없어 사실상 죽은 코드였다 — 관리자가
  // 의견서 최종본을 업로드해도(survey.status=completed) 사용자 마이페이지엔
  // 항상 "별도로 신청하세요" 안내만 뜨고 다운로드 버튼이 절대 안 나오던 버그.
  // 심리상담은 항상 독립 주문(order_type=counseling)으로 진행되고 그 경우는
  // 이 컴포넌트에 도달하기 전에 이미 걸러지므로, 여기서는 survey 유무만으로
  // 판단하는 게 실제 데이터에 맞다.)
  const survey = order.survey;
  if (!survey) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-center bg-slate-50/60">
        <p className="text-sm text-slate-500 mb-3">
          심리상담 의견서가 필요하신가요? 별도로 신청하실 수 있습니다.
        </p>
        <Link
          href="/counseling"
          className="inline-flex items-center justify-center rounded-lg bg-white border border-zinc-300 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
        >
          심리상담 의견서 추가하기
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
    cancelled: { label: "취소됨", className: "bg-zinc-100 text-zinc-600 ring-zinc-500/20" },
    refunded: { label: "환불됨", className: "bg-zinc-100 text-zinc-600 ring-zinc-500/20" },
  };
  const { label, className } = map[status];
  return (
    <span className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-bold ring-1 ${className}`}>
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
