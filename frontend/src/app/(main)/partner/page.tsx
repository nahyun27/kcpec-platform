import { CheckCircle2, Clock3, FileCheck2, HeartHandshake, Scale, Sparkles } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import PartnerApplyForm from "./_ApplyForm";

export const metadata = {
  title: "변호사 사무실 파트너 모집 | KCPEC",
  description: "의뢰인 양형자료 준비를 KCPEC과 함께하는 변호사 사무실 파트너 모집 안내",
};

const STATS = [
  { value: "25개", label: "교육과정 보유" },
  { value: "즉시 발급", label: "수강 완료 시 수료증" },
  { value: "15,000건+", label: "누적 발급" },
  { value: "100%", label: "전문가 감수 교육" },
];

const REASONS = [
  {
    icon: FileCheck2,
    title: "사건별 맞춤 교육",
    desc: "14개 사건 유형과 추가 교육 10종 중 의뢰인 사건에 맞는 과정을 자동으로 추천합니다. 사무실에서 과정을 따로 골라주실 필요가 없습니다.",
  },
  {
    icon: Clock3,
    title: "수강 완료 즉시 발급",
    desc: "교육을 마치는 즉시 수료증과 서약서를 PDF로 발급합니다. 기일이 임박한 사건도 바로 제출 준비가 가능합니다.",
  },
  {
    icon: HeartHandshake,
    title: "전문가 심리상담 의견서",
    desc: "서면 상담 77,000원. 신청 시 자기성찰 리포트, 교육이수 소감문 등 4가지 서류를 추가 비용 없이 함께 제공합니다.",
  },
];

const CASE_TYPES = [
  "음주운전",
  "성범죄",
  "성매매",
  "디지털 성범죄",
  "스토킹",
  "마약",
  "도박",
  "보이스피싱",
  "사기·횡령·배임",
  "폭력",
  "명예훼손·모욕",
  "학교폭력",
  "청소년범죄",
  "무면허·도로교통법",
];

const DOCUMENTS = [
  "교육 수료증 + 서약서",
  "전문가 심리상담 의견서",
  "자기성찰 리포트",
  "교육이수 소감문",
  "CBT 기반 재범방지 자가진단 검사지",
  "맞춤형 양형자료 준비 가이드북",
  "반성문 작성 (AI 초안 지원)",
  "탄원서 작성 (AI 초안 지원)",
];

export default function PartnerPage() {
  return (
    <div id="top" className="min-h-screen bg-slate-50/50">
      {/* 히어로 — 신청서를 스크롤 없이 바로 보이게 상단에 배치 */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 pb-16 pt-14 md:pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-[var(--color-accent)]/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14">
            <Reveal>
              <div className="text-center lg:text-left">
                <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-blue-200 ring-1 ring-white/20 backdrop-blur">
                  <Scale className="h-3.5 w-3.5" />
                  변호사 사무실 파트너 안내
                </div>
                <h1 className="font-sans text-3xl font-extrabold tracking-tight text-white md:text-[40px] md:leading-[1.2]">
                  의뢰인 양형자료 준비,
                  <br />
                  믿고 맡기실 수 있는 곳을 찾으셨다면
                </h1>
                <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-300 md:text-[17px] lg:mx-0">
                  사건 유형만 선택하면 필요한 재범방지교육과 제출 서류를 자동으로
                  안내하고, 온라인 수강을 마치는 즉시 법원·검찰·경찰 제출용
                  수료증을 발급합니다.
                </p>

                <div className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-3 sm:grid-cols-4 lg:mx-0 lg:max-w-none">
                  {STATS.map((s) => (
                    <div
                      key={s.label}
                      className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center backdrop-blur"
                    >
                      <p className="font-sans text-lg font-black text-white sm:text-xl">
                        {s.value}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={150}>
              <div className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl shadow-black/30">
                <div className="flex items-center gap-2 bg-[var(--color-primary)] px-6 py-4">
                  <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
                  <p className="font-sans text-sm font-bold text-white">
                    파트너 신청하기
                  </p>
                </div>
                <div className="p-6">
                  <p className="mb-4 text-xs leading-relaxed text-slate-500">
                    신청하시면 검토 후 사무실 전용 추천 코드와 QR, 전용 페이지
                    링크를 이메일로 보내드립니다.
                  </p>
                  <PartnerApplyForm />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-12 px-6 pb-24 pt-14 md:pt-16">
        <Reveal as="section" className="space-y-5">
          <h2 className="font-sans text-xl font-bold text-[var(--color-primary)] sm:text-2xl">
            변호사님들이 의뢰인께 추천하시는 이유
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {REASONS.map((r) => (
              <div
                key={r.title}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[var(--color-accent)]">
                  <r.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-sans text-base font-bold text-slate-900">
                  {r.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{r.desc}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal as="section" className="space-y-5">
          <h2 className="font-sans text-xl font-bold text-[var(--color-primary)] sm:text-2xl">
            사건 유형
          </h2>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {CASE_TYPES.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {t}
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-500">구속수용자 교육 별도 운영</p>
          </div>
        </Reveal>

        <Reveal as="section" className="space-y-5">
          <h2 className="font-sans text-xl font-bold text-[var(--color-primary)] sm:text-2xl">
            발급 가능 서류{" "}
            <span className="text-base font-medium text-slate-400">
              (사건에 따라 최대 11종)
            </span>
          </h2>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {DOCUMENTS.map((d) => (
                <li key={d} className="flex items-start gap-2 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal
          as="section"
          className="rounded-3xl border-2 border-[var(--color-primary)] bg-gradient-to-br from-blue-50 to-indigo-50 p-6 text-center shadow-sm sm:p-10"
        >
          <p className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-white">
            Lawyer Referral
          </p>
          <h2 className="mt-4 font-sans text-2xl font-black text-slate-900 sm:text-3xl">
            변호사 사무실 파트너가 되시면
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
            등록해 드리는 사무실 전용 추천 코드를 의뢰인께 안내해 주시면 됩니다. 의뢰인이
            결제 시 그 코드를 입력하면 10% 할인이 자동 적용됩니다.
          </p>
          <a
            href="#top"
            className="mt-6 inline-flex items-center rounded-full bg-[var(--color-primary)] px-7 py-3 text-sm font-bold text-white shadow-md hover:bg-[var(--color-primary-hover)]"
          >
            위에서 바로 신청하기 ↑
          </a>
        </Reveal>
      </div>
    </div>
  );
}
