"use client";

// 마이페이지 "내 서류" 탭 + 상단 "한눈에 보기"/"지금 할 일"(2026-11).
// 수료증은 강의 카드 안, 의견서는 심리상담 탭, 반성문·탄원서는 별도 페이지,
// 구속수용자 수료증은 또 다른 곳에 흩어져 있어 "어디서 받아요?" 문의가
// 반복됐다. 이미 마이페이지가 불러온 데이터로 한 화면에 모은다.

import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Download,
  FileCheck2,
  FileText,
  Hourglass,
  MessageSquare,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { absUrl, markDocumentDownloaded } from "@/lib/api";
import type { CounselingOrderItem, EnrollmentWithProgress } from "@/types/counseling";
import { counselingDisplayTitle } from "@/types/counseling";
import type { DetentionMineRow } from "@/types/detention";
import { LEGAL_LETTER_LABEL, type LegalLetterStatus } from "@/types/legalLetter";
import type { DocumentResponse, OrderResponse } from "@/types/order";

export type DocOrder = OrderResponse & { documents: DocumentResponse[] };

export const COUNSELING_BONUS_MATERIALS: { label: string; path: string }[] = [
  { label: "자기성찰 리포트", path: "/static/resources/self_reflection_report.pdf" },
  { label: "교육이수 소감문", path: "/static/resources/course_completion_journal.pdf" },
  { label: "CBT 자가진단 검사지", path: "/static/resources/cbt_self_assessment.pdf" },
  { label: "양형자료 준비 가이드북", path: "/static/resources/sentencing_materials_guidebook.pdf" },
];

type Kind = "certificate" | "counseling" | "letter" | "detention";

type DocLink = {
  label: string;
  url: string;
  primary?: boolean;
  track?: { orderId: number; documentId: number };
};

type ReadyDoc = {
  key: string;
  kind: Kind;
  title: string;
  meta: string[];
  links: DocLink[];
  date: number;
};

type PendingDoc = {
  key: string;
  kind: Kind;
  title: string;
  state: string;
  action?: { label: string; href: string };
  // 고객이 직접 해야 하는 일이면 true("지금 할 일"에 올라감), 기다리기만 하면 false
  needsUser: boolean;
};

export type Overview = {
  ready: ReadyDoc[];
  pending: PendingDoc[];
  todos: PendingDoc[];
  activeCourses: number;
  inProgress: number;
};

function fmt(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString("ko-KR") : "";
}

function ts(iso: string | null | undefined): number {
  return iso ? new Date(iso).getTime() : 0;
}

function isExpired(e: EnrollmentWithProgress): boolean {
  return !!e.expires_at && new Date(e.expires_at).getTime() < Date.now();
}

export function buildOverview(input: {
  orders: DocOrder[];
  enrollments: EnrollmentWithProgress[];
  counselingOrders: CounselingOrderItem[];
  detentionRows: DetentionMineRow[];
  legalLetters: LegalLetterStatus[];
}): Overview {
  const { orders, enrollments, counselingOrders, detentionRows, legalLetters } = input;
  const ready: ReadyDoc[] = [];
  const pending: PendingDoc[] = [];
  const letterOrderIds = new Set(legalLetters.map((l) => l.order_id));

  // 1) 강의 수료증(본인 수강분) — 구속수용자용 주문 수료증은 아래 4)에서.
  const certCourseIds = new Set<number>();
  for (const o of orders) {
    if (o.status !== "paid" || o.detention_inmate || letterOrderIds.has(o.id)) continue;
    for (const d of o.documents) {
      if (d.status === "revoked" || !d.pdf_url || d.document_type !== "certificate") continue;
      certCourseIds.add(o.course_id);
      const links: DocLink[] = [
        { label: "수료증", url: d.pdf_url, primary: true, track: { orderId: o.id, documentId: d.id } },
      ];
      if (d.pledge_pdf_url)
        links.push({ label: "서약서", url: d.pledge_pdf_url, track: { orderId: o.id, documentId: d.id } });
      ready.push({
        key: `cert-${d.id}`,
        kind: "certificate",
        title: `${o.course_title ?? "강의"} 수료증`,
        meta: [d.recipient_name, `발급 ${fmt(d.issued_at)}`, d.issue_number],
        links,
        date: ts(d.issued_at),
      });
    }
  }

  // 2) 수료증이 아직 없는 강의 — 다음 단계 안내
  for (const e of enrollments) {
    if (e.category === "심리상담" || certCourseIds.has(e.course_id)) continue;
    const order = orders.find(
      (o) => o.course_id === e.course_id && o.status === "paid" && !o.detention_inmate,
    );
    if (e.is_completed) {
      if (!order) continue;
      pending.push({
        key: `course-${e.course_id}`,
        kind: "certificate",
        title: `${e.course_title} 수료증`,
        state: "수료 완료! 이름과 생년월일을 입력하면 바로 발급돼요.",
        action: { label: "수료증 발급하기", href: `/issue?order_id=${order.id}` },
        needsUser: true,
      });
    } else if (isExpired(e)) {
      continue;
    } else if (e.total_lectures > 0 && e.completed_lectures >= e.total_lectures && e.has_quiz) {
      pending.push({
        key: `course-${e.course_id}`,
        kind: "certificate",
        title: `${e.course_title} 수료증`,
        state: "강의를 다 들었어요. 퀴즈만 통과하면 수료증이 발급돼요.",
        action: { label: "퀴즈 응시", href: `/courses/${e.course_id}/quiz` },
        needsUser: true,
      });
    } else {
      pending.push({
        key: `course-${e.course_id}`,
        kind: "certificate",
        title: `${e.course_title} 수료증`,
        state:
          e.total_lectures > 0
            ? `${e.completed_lectures}/${e.total_lectures}차시 완료. 끝까지 듣고 퀴즈를 통과하면 발급돼요.`
            : "강의를 끝까지 듣고 퀴즈를 통과하면 발급돼요.",
        action: {
          label: e.overall_progress_pct > 0 ? "이어서 수강" : "수강 시작",
          href: `/courses/${e.course_id}/watch`,
        },
        // 수강 자체는 "할 일"로 매번 띄우면 시끄러워서 넣지 않는다.
        needsUser: false,
      });
    }
  }

  // 3) 심리상담 의견서
  for (const c of counselingOrders) {
    if (c.status !== "paid") continue;
    const title = counselingDisplayTitle(c.program_title);
    if (c.survey_status === "completed" && c.final_pdf_url) {
      ready.push({
        key: `counsel-${c.order_id}`,
        kind: "counseling",
        title,
        meta: [c.paid_at ? `결제 ${fmt(c.paid_at)}` : ""].filter(Boolean),
        links: [
          { label: "의견서", url: c.final_pdf_url, primary: true },
          ...COUNSELING_BONUS_MATERIALS.map((m) => ({ label: m.label, url: m.path })),
        ],
        date: ts(c.paid_at),
      });
    } else if (c.survey_status == null) {
      pending.push({
        key: `counsel-${c.order_id}`,
        kind: "counseling",
        title,
        state: "설문을 작성해 주셔야 의견서 작성이 시작돼요.",
        action: { label: "설문 작성하기", href: `/survey?counseling_order_id=${c.order_id}` },
        needsUser: true,
      });
    } else {
      pending.push({
        key: `counsel-${c.order_id}`,
        kind: "counseling",
        title,
        state: "전문가가 검토하고 있어요. 완료되면 여기에서 바로 받을 수 있어요.",
        needsUser: false,
      });
    }
  }

  // 4) 반성문·탄원서
  for (const l of legalLetters) {
    if (!l.paid) continue;
    const label = LEGAL_LETTER_LABEL[l.letter_type];
    if (l.status === "released" && l.pdf_url) {
      ready.push({
        key: `letter-${l.order_id}`,
        kind: "letter",
        title: label,
        meta: [`발급 ${fmt(l.released_at)}`],
        links: [{ label: `${label} PDF`, url: l.pdf_url, primary: true }],
        date: ts(l.released_at),
      });
    } else if (l.status === "not_submitted") {
      pending.push({
        key: `letter-${l.order_id}`,
        kind: "letter",
        title: label,
        state: "몇 가지 질문에 답해 주시면 초안을 작성해 드려요.",
        action: { label: `${label} 작성하기`, href: `/legal-letters/${l.order_id}` },
        needsUser: true,
      });
    } else {
      pending.push({
        key: `letter-${l.order_id}`,
        kind: "letter",
        title: label,
        state: "담당자가 검토하고 있어요. 최종본이 올라가면 여기에서 받을 수 있어요.",
        action: { label: "작성 내용 보기", href: `/legal-letters/${l.order_id}` },
        needsUser: false,
      });
    }
  }

  // 5) 구속수용자 교육 수료증
  for (const r of detentionRows) {
    for (const c of r.certificates) {
      const links: DocLink[] = [];
      if (c.pdf_url)
        links.push({
          label: "수료증",
          url: c.pdf_url,
          primary: true,
          track: { orderId: c.order_id, documentId: c.document_id },
        });
      if (c.pledge_pdf_url)
        links.push({
          label: "서약서",
          url: c.pledge_pdf_url,
          track: { orderId: c.order_id, documentId: c.document_id },
        });
      ready.push({
        key: `det-${c.document_id}`,
        kind: "detention",
        title: `${c.course_title} 수료증`,
        meta: [`수용자 ${r.inmate_name}`, c.issue_number],
        links,
        date: ts(r.completed_at),
      });
    }
    if (r.certificates.length > 0 || r.status === "cancelled") continue;
    const now = Date.now();
    const canConfirm =
      r.status === "materials_sent" &&
      !r.learning_confirmed_at &&
      !!r.confirm_available_at &&
      now >= new Date(r.confirm_available_at).getTime();
    pending.push({
      key: `det-app-${r.id}`,
      kind: "detention",
      title: `구속수용자 교육 수료증 (수용자 ${r.inmate_name})`,
      state:
        r.status === "received"
          ? "교육자료 발송을 준비하고 있어요."
          : canConfirm
            ? "학습을 마치셨으면 '학습 완료 확인'을 눌러 주세요. 확인 후 수료증이 발급돼요."
            : r.learning_confirmed_at
              ? "학습 완료가 확인됐어요. 수료증 발급을 준비하고 있어요."
              : `교육자료를 보냈어요. ${fmt(r.confirm_available_at)}부터 학습 완료 확인을 할 수 있어요.`,
      action: { label: canConfirm ? "학습 완료 확인" : "신청 내역 보기", href: "/detention/my" },
      needsUser: canConfirm,
    });
  }

  // 6) 가상계좌 입금 대기 — 서류는 아니지만 "지금 할 일"
  const todos = pending.filter((p) => p.needsUser);
  for (const o of orders) {
    if (o.status === "pending" && o.payment_method === "bank_transfer" && o.va_account_number) {
      todos.unshift({
        key: `va-${o.id}`,
        kind: "certificate",
        title: "가상계좌 입금 대기",
        state: `${o.course_title ?? "주문"} · 입금 기한 ${fmt(o.va_due_date)}. 입금하면 바로 수강할 수 있어요.`,
        action: { label: "계좌 보기", href: "/mypage?tab=orders" },
        needsUser: true,
      });
    }
  }
  // 같은 결제의 가상계좌 안내는 묶음당 한 번만
  const seenVa = new Set<string>();
  const dedupTodos = todos.filter((t) => {
    if (!t.key.startsWith("va-")) return true;
    const o = orders.find((x) => `va-${x.id}` === t.key);
    const k = o?.bundle_id ?? t.key;
    if (seenVa.has(k)) return false;
    seenVa.add(k);
    return true;
  });

  ready.sort((a, b) => b.date - a.date);
  return {
    ready,
    pending,
    todos: dedupTodos,
    activeCourses: enrollments.filter(
      (e) => e.category !== "심리상담" && !e.is_completed && !isExpired(e),
    ).length,
    inProgress: pending.filter((p) => !p.needsUser && p.kind !== "certificate").length,
  };
}

const KIND_ICON: Record<Kind, React.ReactNode> = {
  certificate: <FileCheck2 className="h-5 w-5" />,
  counseling: <FileText className="h-5 w-5" />,
  letter: <ScrollText className="h-5 w-5" />,
  detention: <ShieldCheck className="h-5 w-5" />,
};

const KIND_LABEL: Record<Kind, string> = {
  certificate: "수료증",
  counseling: "심리상담",
  letter: "반성문·탄원서",
  detention: "구속수용자",
};

// ---------- 상단: 한눈에 보기 + 지금 할 일 ----------------------------------------

export function OverviewStrip({
  overview,
  unansweredInquiries,
  onGo,
}: {
  overview: Overview;
  unansweredInquiries: number;
  onGo: (tab: "courses" | "documents" | "inquiry") => void;
}) {
  const tiles: { label: string; value: number; tab: "courses" | "documents" | "inquiry"; icon: React.ReactNode }[] = [
    { label: "수강 중", value: overview.activeCourses, tab: "courses", icon: <BookOpen className="h-4 w-4" /> },
    { label: "받을 수 있는 서류", value: overview.ready.length, tab: "documents", icon: <Download className="h-4 w-4" /> },
    { label: "검토·준비 중", value: overview.inProgress, tab: "documents", icon: <Hourglass className="h-4 w-4" /> },
    { label: "답변 대기 문의", value: unansweredInquiries, tab: "inquiry", icon: <MessageSquare className="h-4 w-4" /> },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {tiles.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => onGo(t.tab)}
            className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 text-left shadow-sm transition-colors hover:border-[var(--color-primary)]/40"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span className="shrink-0 text-slate-400">{t.icon}</span>
              <span className="truncate">{t.label}</span>
            </span>
            <span
              className={`text-xl font-bold tabular-nums ${t.value > 0 ? "text-slate-900" : "text-slate-300"}`}
            >
              {t.value}
            </span>
          </button>
        ))}
      </div>

      {overview.todos.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 sm:p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-amber-900">
            <AlertCircle className="h-4 w-4" /> 지금 할 일 {overview.todos.length}건
          </p>
          <ul className="space-y-2">
            {overview.todos.slice(0, 4).map((t) => (
              <li
                key={t.key}
                className="flex flex-col gap-2 rounded-lg bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">{t.title}</p>
                  <p className="text-xs text-slate-500">{t.state}</p>
                </div>
                {t.action ? (
                  <Link
                    href={t.action.href}
                    className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-xs font-bold text-white hover:bg-[var(--color-primary-hover)]"
                  >
                    {t.action.label} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ---------- 내 서류 탭 ------------------------------------------------------------

export function DocumentsTab({ overview }: { overview: Overview }) {
  const { ready, pending } = overview;
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-end justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900">
            받을 수 있는 서류 <span className="text-[var(--color-primary)]">{ready.length}</span>
          </h3>
          <p className="hidden text-xs text-slate-400 sm:block">PDF로 받아 출력하거나 이메일로 제출하세요.</p>
        </div>
        {ready.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
            <p className="text-sm text-slate-500">아직 발급된 서류가 없어요.</p>
            <p className="mt-1 text-xs text-slate-400">강의를 수료하거나 상담이 완료되면 여기에 모여요.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {ready.map((d) => (
              <li key={d.key} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    {KIND_ICON[d.kind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-emerald-700">{KIND_LABEL[d.kind]}</p>
                    <p className="text-[15px] font-bold text-slate-900">{d.title}</p>
                    {d.meta.filter(Boolean).length > 0 ? (
                      <p className="mt-0.5 text-xs text-slate-400">{d.meta.filter(Boolean).join(" · ")}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {d.links.map((l) => (
                        <a
                          key={l.label}
                          href={absUrl(l.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            if (l.track)
                              void markDocumentDownloaded(l.track.orderId, l.track.documentId).catch(() => {});
                          }}
                          className={
                            l.primary
                              ? "inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[var(--color-primary-hover)]"
                              : "inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                          }
                        >
                          <Download className="h-3.5 w-3.5" /> {l.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pending.length > 0 ? (
        <section>
          <h3 className="mb-3 text-base font-bold text-slate-900">
            준비 중인 서류 <span className="text-slate-400">{pending.length}</span>
          </h3>
          <ul className="space-y-2">
            {pending.map((p) => (
              <li
                key={p.key}
                className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200">
                    {KIND_ICON[p.kind]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700">{p.title}</p>
                    <p className="text-xs text-slate-500">{p.state}</p>
                  </div>
                </div>
                {p.action ? (
                  <Link
                    href={p.action.href}
                    className={`inline-flex shrink-0 items-center justify-center rounded-lg px-3.5 py-2 text-xs font-bold ${
                      p.needsUser
                        ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
                        : "border border-zinc-200 bg-white text-slate-600 hover:text-[var(--color-primary)]"
                    }`}
                  >
                    {p.action.label}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
