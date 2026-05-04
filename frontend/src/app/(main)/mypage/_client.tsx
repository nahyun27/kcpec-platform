"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import {
  getMe,
  getMyEnrollments,
  getMyOrders,
  getOrderDocuments,
  getSurveyStatus,
  tokenStorage,
  type UserResponse,
} from "@/lib/api";
import type {
  CounselingStatus,
  EnrollmentWithProgress,
  SurveyStatusResponse,
} from "@/types/counseling";
import {
  COUNSELING_STATUS_LABEL,
} from "@/types/counseling";
import {
  PAYMENT_METHOD_LABEL,
  type DocumentResponse,
  type OrderResponse,
} from "@/types/order";

type OrderWithExtras = OrderResponse & {
  documents: DocumentResponse[];
  survey?: SurveyStatusResponse | null;
};

export default function MyPageClient() {
  const router = useRouter();
  const [me, setMe] = useState<UserResponse | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentWithProgress[]>([]);
  const [orders, setOrders] = useState<OrderWithExtras[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenStorage.getAccess()) {
      router.replace("/login?next=/mypage");
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const [u, e, o] = await Promise.all([getMe(), getMyEnrollments(), getMyOrders()]);
        if (cancelled) return;
        setMe(u);
        setEnrollments(e);

        // 주문별로 문서/설문 상태를 병렬 조회. 실패한 항목은 빈 값으로 폴백.
        const enriched = await Promise.all(
          o.map(async (order) => {
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
    return <p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>;
  }
  if (error) {
    return <p className="py-20 text-center text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-10">
      <header>
        <h1 className="font-sans text-3xl font-bold text-[var(--color-primary)]">
          마이페이지
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          수강 현황, 결제·발급 내역, 계정 정보를 한 곳에서 확인하세요.
        </p>
      </header>

      <Section title="수강 현황">
        {enrollments.length === 0 ? (
          <EmptyState
            text="등록한 강의가 없습니다."
            cta={{ href: "/courses", label: "강의 둘러보기" }}
          />
        ) : (
          <ul className="space-y-3">
            {enrollments.map((e) => (
              <EnrollmentRow key={e.course_id} enrollment={e} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="결제 · 발급 내역">
        {orders.length === 0 ? (
          <EmptyState text="결제 내역이 없습니다." />
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="계정 정보">
        {me ? (
          <dl className="grid grid-cols-1 gap-4 rounded-lg border border-[var(--color-border)] bg-white p-6 sm:grid-cols-3">
            <Field label="아이디" value={me.username} />
            <Field label="이메일" value={me.email} />
            <Field
              label="가입일"
              value={new Date(me.created_at).toLocaleDateString("ko-KR")}
            />
          </dl>
        ) : null}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-sans text-xl font-bold text-[var(--color-primary)]">{title}</h2>
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
    <div className="rounded-lg border border-[var(--color-border)] bg-white p-8 text-center text-sm text-zinc-500">
      <p>{text}</p>
      {cta ? (
        <Link
          href={cta.href}
          className="mt-3 inline-block rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}

function EnrollmentRow({ enrollment }: { enrollment: EnrollmentWithProgress }) {
  return (
    <li className="rounded-lg border border-[var(--color-border)] bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-[var(--color-accent)]">
            {enrollment.category}
          </p>
          <p className="font-sans text-base font-semibold text-zinc-900">
            {enrollment.course_title}
          </p>
        </div>
        {enrollment.is_completed ? (
          <span className="rounded bg-[var(--color-accent)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-accent)]">
            수료 완료
          </span>
        ) : (
          <span className="rounded bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-primary)]">
            수강 중
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-zinc-500">진도율</span>
          <span className="font-semibold text-[var(--color-primary)]">
            {enrollment.overall_progress_pct}%
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full bg-[var(--color-accent)] transition-[width]"
            style={{ width: `${enrollment.overall_progress_pct}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/courses/${enrollment.course_id}/watch`}
          className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs hover:border-[var(--color-primary)]"
        >
          이어보기
        </Link>
        {enrollment.is_completed ? (
          <Link
            href={`/checkout?course_id=${enrollment.course_id}`}
            className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)]"
          >
            수료증 발급 결제
          </Link>
        ) : (
          <Link
            href={`/courses/${enrollment.course_id}/quiz`}
            className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs hover:border-[var(--color-primary)]"
          >
            퀴즈 보기
          </Link>
        )}
      </div>
    </li>
  );
}

function OrderRow({ order }: { order: OrderWithExtras }) {
  const isPaid = order.status === "paid";
  return (
    <li className="space-y-3 rounded-lg border border-[var(--color-border)] bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs text-zinc-500">주문 #{order.id}</p>
          <p className="font-sans text-base font-semibold text-zinc-900">
            {order.amount.toLocaleString()}원 · {PAYMENT_METHOD_LABEL[order.payment_method]}
          </p>
          <p className="text-xs text-zinc-500">
            {new Date(order.created_at).toLocaleString("ko-KR")}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {isPaid ? (
        <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
          <p className="text-xs font-semibold text-zinc-700">발급 문서</p>
          {order.documents.length > 0 ? (
            <ul className="space-y-1">
              {order.documents.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="text-zinc-700">
                    이수증 · {d.issue_number}
                  </span>
                  {d.pdf_url ? (
                    <a
                      href={d.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)]"
                    >
                      PDF 다운로드
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">아직 발급된 이수증이 없습니다.</p>
          )}
          {order.documents.length === 0 ? (
            <Link
              href={`/issue?order_id=${order.id}`}
              className="inline-block rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)]"
            >
              이수증 발급하기
            </Link>
          ) : null}

          <CounselingRow order={order} />
        </div>
      ) : null}
    </li>
  );
}

function CounselingRow({ order }: { order: OrderWithExtras }) {
  const survey = order.survey;
  if (!survey) {
    // 패키지에 counseling 이 포함된 경우라면 설문 작성으로 유도.
    // (Standard/Premium 구분 정보는 백엔드 응답에 없어 일단 링크 노출 후
    //  서버가 403 으로 거른다.)
    return (
      <Link
        href={`/survey?order_id=${order.id}`}
        className="inline-block rounded border border-[var(--color-border)] px-3 py-1.5 text-xs text-zinc-700 hover:border-[var(--color-primary)]"
      >
        심리상담 의견서 설문 작성
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-zinc-50 px-3 py-2 text-sm">
      <span className="text-zinc-700">
        심리상담 의견서 — {COUNSELING_STATUS_LABEL[survey.status as CounselingStatus]}
      </span>
      {survey.status === "completed" && survey.final_pdf_url ? (
        <a
          href={survey.final_pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)]"
        >
          PDF 다운로드
        </a>
      ) : null}
    </div>
  );
}

function OrderStatusBadge({ status }: { status: OrderResponse["status"] }) {
  const map: Record<OrderResponse["status"], { label: string; className: string }> = {
    paid: { label: "결제 완료", className: "bg-emerald-100 text-emerald-700" },
    pending: { label: "결제 대기", className: "bg-amber-100 text-amber-700" },
    cancelled: { label: "취소", className: "bg-zinc-200 text-zinc-700" },
    refunded: { label: "환불", className: "bg-zinc-200 text-zinc-700" },
  };
  const { label, className } = map[status];
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-1 font-medium text-zinc-900">{value}</dd>
    </div>
  );
}
