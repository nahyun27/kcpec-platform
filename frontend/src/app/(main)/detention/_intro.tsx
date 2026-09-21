import {
  AlertCircle,
  ArrowDown,
  BadgePercent,
  BookOpenCheck,
  CalendarCheck,
  CheckCircle2,
  Download,
  FileCheck2,
  HeartHandshake,
  PackageCheck,
  Truck,
  Users,
} from "lucide-react";

// 서버 컴포넌트 — 검색엔진이 읽을 수 있도록 설명 영역은 서버에서 렌더링한다.
// 결과(감형·집행유예 등)를 약속하는 문구, 사례·후기·전문가 발언은 넣지 않는다.

const GUARDIAN_POINTS = [
  {
    icon: HeartHandshake,
    title: "보호자가 대신 신청",
    desc: "수감 중에는 본인이 직접 준비할 수 있는 범위가 제한적이라, 신청과 결제는 보호자께서 대신 진행하실 수 있도록 만들었습니다.",
  },
  {
    icon: PackageCheck,
    title: "입력은 간단하게",
    desc: "수용자 정보와 수용시설 주소(또는 우체국 사서함)만 입력하시면, 교육자료 발송은 저희가 진행합니다.",
  },
  {
    icon: Users,
    title: "가족분도 함께",
    desc: "같은 신청서에서 본인 명의의 재범방지교육 수강과 심리상담도 함께 선택하실 수 있습니다.",
  },
];

const STEPS = [
  {
    icon: FileCheck2,
    title: "신청·결제",
    desc: "보호자가 수용자 정보를 입력하고 교육과정을 선택해 결제합니다.",
  },
  {
    icon: Truck,
    title: "교육자료 발송",
    desc: "결제 확인 후 발송을 준비해, 신청 당일~다음 날 수용시설 주소로 우편 발송합니다.",
  },
  {
    icon: BookOpenCheck,
    title: "수용자 학습",
    desc: "수용자가 교육자료로 학습합니다. 교육자료 안에 퀴즈가 포함되어 있습니다.",
  },
  {
    icon: CheckCircle2,
    title: "학습 확인·수료증",
    desc: "발송 7일 후 신청하신 분이 마이페이지에서 '학습 완료 확인'을 누르면, 수료증을 발급해 마이페이지에서 내려받으실 수 있습니다.",
  },
];

const TIMELINE = [
  { icon: Truck, label: "교육자료 발송", value: "신청 당일 ~ 다음 날" },
  { icon: PackageCheck, label: "자료 도착", value: "수용시설·우편 사정에 따라 달라집니다" },
  { icon: CalendarCheck, label: "학습 완료 확인", value: "교육자료 발송일로부터 7일 후부터 가능" },
  { icon: Download, label: "수료증 확인", value: "학습 완료 확인 후 발급 — 마이페이지에서 다운로드" },
];

const NOTICES = [
  "교육자료는 신청 즉시 발송 준비에 들어가므로, 신청·결제 후에는 환불이 어렵습니다.",
  "수용시설의 규정과 우편 사정에 따라 자료 도착이 늦어지거나 반입이 제한될 수 있습니다.",
  "수료증은 교육 이수를 증명하는 자료이며, 재판·수사 결과를 보장하지 않습니다.",
  "수용자의 성명·생년월일·수용번호·시설 정보는 교육자료 발송과 수료증 발급 목적으로만 사용됩니다.",
];

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">{eyebrow}</p>
      <h2 className="mt-1 font-sans text-2xl font-black text-slate-900">{title}</h2>
    </div>
  );
}

export default function DetentionIntro() {
  return (
    <>
      {/* 히어로 */}
      {/* 헤더(h-16) 뒤로 히어로를 끌어올려 헤더 위 흰 띠가 생기지 않게 한다(홈 히어로와 동일). */}
      <div className="relative -mt-16 overflow-hidden bg-gradient-to-br from-[#0a1730] via-[#16295a] to-[#2a4b8d]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 pb-14 pt-28 sm:pb-20 sm:pt-36">
          <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold tracking-wider text-blue-100">
            DETENTION EDUCATION
          </span>
          <h1 className="mt-4 font-sans text-3xl font-black leading-tight text-white sm:text-4xl">
            구속수용자 재범방지교육
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200 sm:text-base">
            구치소·교도소에 계셔서 온라인 수강이 어려운 분을 위해, 보호자께서 대신 신청하시면
            교육자료를 수용시설로 우편 발송해 드립니다. 교육 이수 후 수료증은 마이페이지에서
            발급받으실 수 있습니다.
          </p>
          <a
            href="#apply"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-[#0a1730] shadow-lg transition-transform hover:-translate-y-0.5"
          >
            신청하러 가기
            <ArrowDown className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-16 px-6 py-14">
        {/* 보호자분께 */}
        <section>
          <SectionTitle eyebrow="For Family" title="보호자분께" />
          <p className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/60 px-5 py-4 text-sm leading-relaxed text-slate-700 sm:text-base">
            가족이 수감되어 있으면 무엇을 준비해야 할지 막막하실 수 있습니다.
            <br className="hidden sm:block" /> 결제부터 수료증 수령까지, 이 페이지에서 순서대로 안내해 드립니다.
          </p>
          <ul className="grid gap-4 sm:grid-cols-3">
            {GUARDIAN_POINTS.map(({ icon: Icon, title, desc }) => (
              <li
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-base font-bold text-slate-900">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-5 py-4">
            <BadgePercent className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm leading-relaxed text-emerald-900">
              함께 결제하시면 금액이 합산되어{" "}
              <b>묶음 할인(10만원 이상 시 1만원)</b>이 동일하게 적용됩니다.
            </p>
          </div>
        </section>

        {/* 이용 절차 */}
        <section>
          <SectionTitle eyebrow="Process" title="이용 절차" />
          <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <li
                key={title}
                className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-black text-white">
                    {i + 1}
                  </span>
                  <Icon className="h-6 w-6 text-slate-300" />
                </div>
                <p className="mt-4 text-base font-bold text-slate-900">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
                {i < STEPS.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-400 shadow ring-1 ring-slate-200 lg:flex"
                  >
                    ›
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        {/* 진행 기간 */}
        <section>
          <SectionTitle eyebrow="Timeline" title="진행 기간 안내" />
          <ul className="grid gap-3 sm:grid-cols-2">
            {TIMELINE.map(({ icon: Icon, label, value }) => (
              <li
                key={label}
                className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{value}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 유의사항 */}
        <section>
          <SectionTitle eyebrow="Notice" title="유의사항" />
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-900">
              <AlertCircle className="h-5 w-5" />
              신청 전에 꼭 확인해 주세요
            </div>
            <ul className="space-y-2.5">
              {NOTICES.map((n) => (
                <li key={n} className="flex items-start gap-2.5 text-sm leading-relaxed text-amber-900">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  {n}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}
