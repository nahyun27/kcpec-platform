import Link from "next/link";

export const metadata = {
  title: "이용 안내 | KCPEC",
  description: "한국범죄예방교육센터 서비스 이용 안내",
};

const STEPS = [
  {
    n: "01",
    title: "강의 선택",
    desc: "내 사건에 적합한 교육 과정을 선택합니다. 성범죄·폭력·재산범죄·약물·도박·교통·준법의식 등 25개 과정 중에서 고르실 수 있습니다.",
  },
  {
    n: "02",
    title: "결제",
    desc: "선택한 강의를 결제하면 바로 수강을 시작하실 수 있습니다. (결제일로부터 30일간 수강 가능)",
  },
  {
    n: "03",
    title: "강의 수강 + 퀴즈",
    desc: "모든 영상을 시청하고 퀴즈에 합격하면 수료 처리됩니다.",
  },
  {
    n: "04",
    title: "자료 수령",
    desc: "수료증은 수료 완료 즉시 PDF로 발급받으실 수 있습니다. 심리상담 의견서는 전문가 검토 후 1~2영업일 이내 발급됩니다.",
  },
];

const DOCUMENTS: { name: string; desc: string; href: string; cta: string }[] = [
  {
    name: "강의 수료증",
    desc: "각 강의를 결제 후 수강하여 진도·퀴즈를 모두 통과하면 발급되는 PDF 수료증입니다. 위변조 방지 워터마크와 발급번호가 포함되어 법원·수사기관 제출에 사용하실 수 있습니다.",
    href: "/courses",
    cta: "강의 전체보기",
  },
  {
    name: "심리상담 의견서",
    desc: "전문 심리상담사가 작성하는 법원 제출용 공식 문서입니다. 온라인 설문 기반 서면상담과 전화 심화상담(회당 20분 × 4회) 중 선택해 별도로 구매하실 수 있습니다.",
    href: "/counseling",
    cta: "전문가 심리상담 알아보기",
  },
];

import { BookText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="bg-white pt-10 md:pt-16 relative z-10 border-b border-slate-100">
        <div className="mx-auto max-w-4xl px-6">
          <PageHeader
            title="서비스 이용 안내"
            subtitle="Guide"
            icon={<BookText className="h-3.5 w-3.5" />}
            description="KCPEC의 합리적이고 투명한 교육 서비스 이용 방법을 안내해 드립니다."
          />
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-6 pt-8 md:pt-12 pb-24 space-y-12">

      <Section title="서비스 소개">
        <p>
          한국범죄예방교육센터(KCPEC)는 형사 피의자·피고인을 대상으로 심리·준법교육
          과정을 제공합니다. 강의를 결제하시면 바로 수강을 시작하실 수 있으며,
          수료(진도+퀴즈 통과)하시면 수료증이 즉시 발급됩니다. 전문가 심리상담
          의견서는 별도 상품으로 독립적으로 구매하실 수 있습니다.
        </p>
        <p>
          모든 강의 콘텐츠는 임상 심리·법조 전문가의 감수를 거쳤으며, 발급되는 서류에는
          위변조 방지 워터마크와 발급번호가 포함되어 법원·수사기관 제출에 사용하실 수
          있습니다.
        </p>
      </Section>

      <Section title="발급 서류 안내">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {DOCUMENTS.map((d) => (
            <div
              key={d.name}
              className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <h3 className="font-sans text-base font-bold text-slate-900">
                {d.name}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                {d.desc}
              </p>
              <Link
                href={d.href}
                className="mt-4 inline-flex w-fit items-center rounded-full border border-[var(--color-primary)] px-4 py-1.5 text-xs font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors"
              >
                {d.cta} →
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          가격은 각 강의 상세 페이지 및 결제 화면에서 확인하실 수 있습니다.
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
