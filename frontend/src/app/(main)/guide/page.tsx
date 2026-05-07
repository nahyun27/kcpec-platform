import Link from "next/link";

export const metadata = {
  title: "이용 안내 | KCPEC",
  description: "한국범죄예방교육센터 서비스 이용 안내",
};

const STEPS = [
  {
    n: "01",
    title: "강의 선택",
    desc: "내 사건에 적합한 교육 과정을 선택합니다. 카테고리는 음주·성범죄·디지털성범죄 등 11종입니다.",
  },
  {
    n: "02",
    title: "무료 수강 + 퀴즈",
    desc: "모든 영상을 시청하고 퀴즈에 합격하면 수료 처리됩니다. 진도와 퀴즈 응시 모두 무료입니다.",
  },
  {
    n: "03",
    title: "패키지 결제",
    desc: "필요한 발급 자료(수료증/가이드/심리상담 의견서 등)에 맞춰 패키지를 선택하고 결제합니다.",
  },
  {
    n: "04",
    title: "자료 수령",
    desc: "수료증은 즉시 PDF 다운로드, 심리상담 의견서는 전문가 검토 후 24시간 이내 이메일 발송됩니다.",
  },
];

const TIERS: {
  name: string;
  description: string;
  items: { label: string; included: boolean }[];
}[] = [
  {
    name: "Basic",
    description: "수료증 단건 발급",
    items: [
      { label: "수료증 PDF", included: true },
      { label: "양형자료 가이드", included: false },
      { label: "심리상담 의견서", included: false },
      { label: "CBT 자료", included: false },
      { label: "1:1 상담", included: false },
    ],
  },
  {
    name: "Standard",
    description: "수료증 + 양형자료 가이드",
    items: [
      { label: "수료증 PDF", included: true },
      { label: "양형자료 가이드", included: true },
      { label: "심리상담 의견서", included: false },
      { label: "CBT 자료", included: false },
      { label: "1:1 상담", included: false },
    ],
  },
  {
    name: "Premium",
    description: "수료증 + 모든 양형 자료 패키지",
    items: [
      { label: "수료증 PDF", included: true },
      { label: "양형자료 가이드", included: true },
      { label: "심리상담 의견서", included: true },
      { label: "CBT 자료", included: true },
      { label: "1:1 상담", included: true },
    ],
  },
];

import { BookText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-6 py-12 pb-24">
      <PageHeader
        title="서비스 이용 안내"
        subtitle="KCPEC 이용 안내"
        icon={<BookText className="h-3.5 w-3.5" />}
        description="무료 수강 후 필요한 자료만 결제하는 단순한 모델입니다."
      />

      <Section title="서비스 소개">
        <p>
          한국범죄예방교육센터(KCPEC)는 형사 피고인을 대상으로 심리·준법교육 과정을{" "}
          <strong className="text-slate-900">전액 무료</strong> 로 제공합니다.
          교육 수료 후 수료증·심리상담 의견서 등 양형 자료를 패키지 단위로 발급해
          드립니다.
        </p>
        <p>
          모든 강의 콘텐츠는 임상 심리·법조 전문가의 감수를 거쳤으며, 발급되는 서류에는
          위변조 방지 워터마크와 발급번호가 포함되어 법원·수사기관 제출에 사용하실 수
          있습니다.
        </p>
      </Section>

      <Section title="패키지별 제공 서류">
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">제공 서류</th>
                {TIERS.map((t) => (
                  <th key={t.name} className="px-4 py-3 text-center">
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {TIERS[0].items.map((row, idx) => (
                <tr key={row.label}>
                  <td className="px-4 py-3 font-medium text-slate-700">{row.label}</td>
                  {TIERS.map((t) => (
                    <td
                      key={t.name}
                      className={`px-4 py-3 text-center font-semibold ${
                        t.items[idx].included
                          ? "text-[var(--color-accent)]"
                          : "text-zinc-300"
                      }`}
                    >
                      {t.items[idx].included ? "✓" : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          가격은 결제 화면에서 확인하실 수 있습니다.
        </p>
      </Section>

      <Section title="이용 절차">
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <span className="font-sans text-2xl font-bold text-[var(--color-accent)]">
                {s.n}
              </span>
              <h3 className="mt-2 font-sans text-base font-bold text-slate-900">
                {s.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.desc}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="환불 정책">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="font-semibold text-slate-900">환불 가능</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>결제 시스템 오류로 인한 잘못된 결제</li>
            <li>
              결제 후 3일 이내 + 강의 수강을 시작하지 않았고 + 상담을 의뢰하지 않은 경우
            </li>
          </ul>
          <p className="mt-5 font-semibold text-slate-900">환불 불가</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>강의 수강을 시작한 경우</li>
            <li>심리상담 설문을 제출하여 상담을 의뢰한 경우</li>
          </ul>
          <p className="mt-5 text-xs text-slate-500">
            환불 문의는 admin@kcpec.co.kr 로 보내주세요.
          </p>
        </div>
      </Section>

      <Section title="저작권 안내">
        <p>
          본 사이트의 모든 강의 영상, 학습 자료, 수료증·의견서 양식의 저작권은
          주식회사 한국범죄예방교육센터에 있습니다. 무단 복제·배포·재가공을 금합니다.
          개인 양형 자료 제출 외 용도로의 사용은 사전 서면 동의가 필요합니다.
        </p>
      </Section>

      <Section title="개인정보 보호">
        <p>
          회원 가입 시 수집되는 개인정보(아이디, 비밀번호 해시, 이메일, 생년월일)는
          본 서비스 운영 목적으로만 사용되며, 관련 법령이 정하는 보관 기간 종료 후
          파기됩니다. 의견서 발급을 위한 설문 응답은 별도 보관되며 외부에 공개되지
          않습니다.
        </p>
        <p className="text-sm text-slate-500">
          개인정보 관리책임자: 윤승진 / admin@kcpec.co.kr
        </p>
      </Section>

      <div className="rounded-2xl border border-[var(--color-accent)]/30 bg-blue-50/50 p-6 text-center shadow-sm">
        <p className="text-sm text-slate-700">
          더 궁금한 점이 있으신가요? 자주 묻는 질문에서 답을 찾아보세요.
        </p>
        <Link
          href="/faq"
          className="mt-3 inline-block rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
        >
          자주 묻는 질문 보기 →
        </Link>
      </div>
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
      <h2 className="font-sans text-xl font-bold text-[var(--color-primary)] sm:text-2xl">
        {title}
      </h2>
      <div className="space-y-3 text-base leading-relaxed text-slate-700">
        {children}
      </div>
    </section>
  );
}
