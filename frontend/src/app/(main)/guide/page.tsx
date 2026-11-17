import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  BookText,
  ChevronRight,
  CreditCard,
  Download,
  FileSignature,
  FileText,
  HeartHandshake,
  Mail,
  MessageSquare,
  Phone,
  ReceiptText,
  Undo2,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "이용 안내 | KCPEC",
  description:
    "한국범죄예방교육센터 이용 안내 — 재범방지 강의, 전문가 심리상담, 반성문·탄원서, 구속수용자 교육의 신청부터 서류 수령까지.",
};

// 2026-11 전면 개편: 상품별(강의·심리상담·반성문/탄원서·구속수용자) 절차와
// "마이페이지 어디서 받는지"를 실제 화면 기준으로 안내. 내용은 코드 동작
// 기준으로 맞춰 둠 — 정책이 바뀌면 여기도 같이 고칠 것.

type Product = {
  id: string;
  icon: React.ReactNode;
  tone: string;
  name: string;
  summary: string;
  receive: string;
  where: string;
  href: string;
  cta: string;
};

const PRODUCTS: Product[] = [
  {
    id: "course",
    icon: <BookOpen className="h-5 w-5" />,
    tone: "bg-blue-50 text-blue-600",
    name: "재범방지 강의",
    summary: "사건에 맞는 온라인 강의를 듣고 퀴즈를 통과하면 바로 수료",
    receive: "수료증 · 서약서 (PDF)",
    where: "수료 직후 바로",
    href: "/sentencing",
    cta: "맞춤 강의 찾기",
  },
  {
    id: "counseling",
    icon: <HeartHandshake className="h-5 w-5" />,
    tone: "bg-emerald-50 text-emerald-600",
    name: "전문가 심리상담",
    summary: "서면 설문 또는 전화 상담 후 전문 상담사가 의견서 작성",
    receive: "심리상담 의견서 + 부가 자료 4종",
    where: "상담 완료 다음 날",
    href: "/counseling",
    cta: "심리상담 알아보기",
  },
  {
    id: "letters",
    icon: <FileSignature className="h-5 w-5" />,
    tone: "bg-amber-50 text-amber-600",
    name: "반성문 · 탄원서",
    summary: "질문에 답하면 초안을 만들고 담당자가 검토해 완성",
    receive: "반성문 · 탄원서 (PDF)",
    where: "담당자 검토 후",
    href: "/legal-letters",
    cta: "반성문·탄원서 신청",
  },
  {
    id: "detention",
    icon: <Users className="h-5 w-5" />,
    tone: "bg-violet-50 text-violet-600",
    name: "구속수용자 교육",
    summary: "가족이 신청하면 교육자료를 수용시설로 우편 발송",
    receive: "수용자 이름의 수료증 · 서약서",
    where: "학습 완료 확인 후",
    href: "/detention",
    cta: "구속수용자 교육 신청",
  },
];

const TOC = [
  { href: "#overview", label: "한눈에 보기" },
  { href: "#course", label: "재범방지 강의" },
  { href: "#counseling", label: "심리상담" },
  { href: "#letters", label: "반성문·탄원서" },
  { href: "#detention", label: "구속수용자 교육" },
  { href: "#mypage", label: "마이페이지 사용법" },
  { href: "#payment", label: "결제 수단" },
  { href: "#refund", label: "환불 안내" },
  { href: "#etc", label: "저작권·개인정보" },
];

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="relative z-10 border-b border-slate-100 bg-white pt-10 md:pt-16">
        <div className="mx-auto max-w-5xl px-6">
          <PageHeader
            title="서비스 이용 안내"
            subtitle="Guide"
            icon={<BookText className="h-3.5 w-3.5" />}
            description="신청부터 서류를 받기까지, 상품별로 무엇을 하고 어디서 받는지 차례대로 안내해 드려요."
          />
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-16 px-4 pb-24 pt-8 sm:px-6 md:pt-12">
        <nav aria-label="이용 안내 목차" className="flex flex-wrap gap-2">
          {TOC.map((t) => (
            <a
              key={t.href}
              href={t.href}
              className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 transition-colors hover:text-[var(--color-accent)] hover:ring-blue-200"
            >
              {t.label}
            </a>
          ))}
        </nav>

        {/* 한눈에 보기 */}
        <Section id="overview" eyebrow="Overview" title="어떤 서비스가 있나요?">
          <p className="text-slate-600">
            필요한 것만 골라 신청하시면 돼요. 여러 개를 함께 신청하면 한 번에 결제할 수 있어요.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {PRODUCTS.map((p) => (
              <a
                key={p.id}
                href={`#${p.id}`}
                className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${p.tone}`}>{p.icon}</span>
                  <p className="text-lg font-extrabold text-slate-900">{p.name}</p>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{p.summary}</p>
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-2xl bg-slate-50 px-4 py-3 text-[13px]">
                  <dt className="text-slate-400">받는 서류</dt>
                  <dd className="font-bold text-slate-800">{p.receive}</dd>
                  <dt className="text-slate-400">발급 시점</dt>
                  <dd className="font-bold text-slate-800">{p.where}</dd>
                </dl>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-slate-500 group-hover:text-[var(--color-accent)]">
                  자세히 보기 <ChevronRight className="h-4 w-4" />
                </span>
              </a>
            ))}
          </div>
        </Section>

        {/* 재범방지 강의 */}
        <ProductSection
          id="course"
          eyebrow="재범방지 강의"
          title="강의 듣고 수료증 받기"
          link={{ href: "/sentencing", label: "내 사건에 맞는 강의 추천받기" }}
        >
          <Steps
            steps={[
              {
                title: "강의 고르기",
                body: (
                  <>
                    <b>맞춤 강의 찾기</b>에서 사건 유형을 고르면 필요한 강의를 추천해 드려요.
                    강의 전체보기에서 직접 골라도 됩니다.
                  </>
                ),
              },
              {
                title: "결제하고 바로 수강",
                body: <>결제하면 바로 들을 수 있어요. 수강 기간은 결제일부터 30일입니다.</>,
              },
              {
                title: "강의 시청",
                body: (
                  <>
                    <b>마이페이지 › 내 강의실</b>에서 <b>수강 시작하기</b>를 누르세요. 강의는 순서대로 열리고,
                    각 강의를 90% 이상 보면 다음 강의로 넘어가요. 중간에 멈췄다가 이어서 볼 수 있어요.
                  </>
                ),
              },
              {
                title: "퀴즈 통과",
                body: (
                  <>
                    모든 강의를 보면 <b>퀴즈 풀기</b>가 열려요. 70점 이상이면 합격이고, 불합격해도 횟수 제한 없이
                    다시 풀 수 있어요.
                  </>
                ),
              },
              {
                title: "수료증 발급",
                body: (
                  <>
                    <b>수료증 발급하기</b>를 누르고 수료증에 들어갈 <b>성명과 생년월일</b>을 입력하면 수료증과
                    서약서가 바로 만들어져요. 이수일은 실제로 수료한 날짜로 찍혀요.
                  </>
                ),
              },
            ]}
          />
          <Callout tone="amber">
            수료증의 성명·생년월일은 입력한 그대로 인쇄되고, <b>발급 후에는 직접 고칠 수 없어요.</b> 잘못
            입력했다면 1:1 문의로 알려 주세요.
          </Callout>
          <WhereBox
            path={["마이페이지", "내 강의실", "수료증 다운로드 · 서약서 다운로드"]}
            alt={["마이페이지 › 내 서류에서도 받을 수 있어요."]}
            img={{ src: "/images/guide/mypage-courses.jpg", alt: "마이페이지 내 강의실 화면 예시", w: 1100, h: 931 }}
            caption="내 강의실 화면 예시: 수료한 강의에 수료증 다운로드 버튼이 생겨요."
          />
        </ProductSection>

        {/* 심리상담 */}
        <ProductSection
          id="counseling"
          eyebrow="전문가 심리상담"
          title="심리상담 의견서 받기"
          link={{ href: "/counseling", label: "심리상담 프로그램 보기" }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold text-emerald-600">서면 심리상담</p>
              <p className="mt-1 text-lg font-extrabold text-slate-900">설문 작성으로 진행</p>
              <MiniSteps items={["신청·결제", "온라인 설문 작성", "상담사 검토·작성", "의견서 발급 (상담 완료 다음 날)"]} />
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold text-emerald-600">전화 심화상담</p>
              <p className="mt-1 text-lg font-extrabold text-slate-900">상담사와 전화 3회</p>
              <MiniSteps
                items={["신청·결제", "서면 질문 작성", "상담사와 일정 조율 (연락드려요)", "전화 상담 15분 × 3회", "의견서 발급 (상담 종료 다음 날)"]}
              />
            </div>
          </div>
          <ul className="space-y-2 text-[15px] leading-relaxed text-slate-700">
            <Bullet>
              결제 후 <b>마이페이지 › 심리상담</b>에서 <b>설문 작성하기</b>를 눌러 설문을 작성해 주세요. 의견서가
              발급되기 전까지는 설문 내용을 고칠 수 있어요.
            </Bullet>
            <Bullet>
              의견서가 발급되면 가입하신 이메일로도 알림과 다운로드 링크를 보내 드려요.
            </Bullet>
            <Bullet>
              의견서와 함께 <b>자기성찰 리포트, 교육이수 소감문, CBT 자가진단 검사지, 양형자료 준비 가이드북</b>을
              무료로 드려요.
            </Bullet>
          </ul>
          <WhereBox
            path={["마이페이지", "심리상담", "의견서 다운로드"]}
            alt={["마이페이지 › 내 서류", "이메일로 받은 링크"]}
          />
        </ProductSection>

        {/* 반성문·탄원서 */}
        <ProductSection
          id="letters"
          eyebrow="반성문 · 탄원서"
          title="반성문 · 탄원서 받기"
          link={{ href: "/legal-letters", label: "반성문·탄원서 신청하기" }}
        >
          <Steps
            steps={[
              {
                title: "신청·결제",
                body: <>단독으로 신청하거나, 심리상담·맞춤 강의 찾기에서 함께 담아 한 번에 결제할 수 있어요.</>,
              },
              {
                title: "질문에 답하기",
                body: (
                  <>
                    <b>마이페이지 › 내 서류</b>에서 <b>반성문 작성하기</b>(탄원서는 탄원서 작성하기)를 누르고 사건
                    정보와 질문에 답한 뒤 <b>자동 작성하기</b>를 누르세요.
                  </>
                ),
              },
              {
                title: "담당자 검토",
                body: <>답변을 바탕으로 초안을 만들고, 담당자가 직접 검토·수정해서 완성해요.</>,
              },
              {
                title: "PDF 발급",
                body: <>완성되면 이메일로 알려 드려요. 출력해서 마지막에 직접 서명해 제출하시면 됩니다.</>,
              },
            ]}
          />
          <Callout tone="blue">
            최종본이 나오기 전까지는 <b>제출한 내용 수정하기</b>로 답변을 고칠 수 있어요. 최종본이 나온 뒤에는
            1:1 문의로 요청해 주세요.
          </Callout>
          <WhereBox path={["마이페이지", "내 서류", "반성문 PDF · 탄원서 PDF"]} alt={["이메일로 받은 링크"]} />
        </ProductSection>

        {/* 구속수용자 */}
        <ProductSection
          id="detention"
          eyebrow="구속수용자 교육"
          title="가족이 대신 신청하기"
          link={{ href: "/detention", label: "구속수용자 교육 신청하기" }}
        >
          <Steps
            steps={[
              {
                title: "가족이 신청·결제",
                body: (
                  <>
                    로그인한 가족(보호자)이 과정을 고르고 <b>수용자 성명·생년월일, 수용번호, 수용시설</b>을
                    입력해요. 금액은 과정 금액에 교육자료·발송비가 신청 1건당 한 번 더해져요.
                  </>
                ),
              },
              {
                title: "교육자료 우편 발송",
                body: <>퀴즈가 포함된 인쇄 교육자료를 신청 당일~다음 날 수용시설로 보내 드려요.</>,
              },
              {
                title: "수용자 학습",
                body: <>수용자가 시설 안에서 교육자료로 학습해요.</>,
              },
              {
                title: "학습 완료 확인",
                body: (
                  <>
                    발송 7일 후부터 <b>구속수용자 교육 신청 내역</b>에서 <b>학습 완료 확인</b>을 누를 수 있어요.
                  </>
                ),
              },
              {
                title: "수료증 발급",
                body: <>확인되면 수용자 이름으로 수료증·서약서를 발급하고 이메일로 알려 드려요.</>,
              },
            ]}
          />
          <WhereBox
            path={["마이페이지", "내 강의실 맨 위", "구속수용자 교육 수료증"]}
            alt={["마이페이지 › 내 서류", "구속수용자 교육 신청 내역 페이지", "이메일로 받은 링크"]}
          />
        </ProductSection>

        {/* 마이페이지 */}
        <Section id="mypage" eyebrow="My page" title="마이페이지 사용법">
          <p className="text-slate-600">
            발급된 서류는 모두 마이페이지에 모여 있어요. 화면 위쪽 탭으로 이동하세요.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { icon: <BookOpen className="h-4 w-4" />, name: "내 강의실", desc: "강의 이어보기, 퀴즈, 수료증 발급·다운로드" },
              { icon: <Download className="h-4 w-4" />, name: "내 서류", desc: "받을 수 있는 서류와 준비 중인 서류를 한곳에" },
              { icon: <FileText className="h-4 w-4" />, name: "심리상담", desc: "설문 작성, 진행 상태, 의견서·부가 자료" },
              { icon: <CreditCard className="h-4 w-4" />, name: "결제 내역", desc: "결제·가상계좌 정보, 환불 신청" },
              { icon: <MessageSquare className="h-4 w-4" />, name: "1:1 문의", desc: "본인만 보는 문의, 답변은 이메일로도" },
            ].map((t) => (
              <div key={t.name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                  <span className="text-[var(--color-accent)]">{t.icon}</span>
                  {t.name}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{t.desc}</p>
              </div>
            ))}
          </div>
          <Shot
            src="/images/guide/mypage-documents.jpg"
            alt="마이페이지 내 서류 화면 예시"
            w={1100}
            h={817}
            caption="내 서류 화면 예시: 받을 수 있는 서류는 버튼을 눌러 PDF로 받고, 준비 중인 서류는 남은 할 일이 안내돼요."
          />
        </Section>

        {/* 결제 */}
        <Section id="payment" eyebrow="Payment" title="결제 수단">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoCard icon={<CreditCard className="h-5 w-5" />} title="신용·체크카드 / 간편결제">
              카카오페이, 네이버페이, 토스페이, 삼성페이, 페이코 등 간편결제를 쓸 수 있어요.
            </InfoCard>
            <InfoCard icon={<ReceiptText className="h-5 w-5" />} title="실시간 계좌이체 / 가상계좌">
              가상계좌는 입금 기한 안에 입금하시면 자동으로 확인돼요. 따로 연락하실 필요 없어요.
            </InfoCard>
          </div>
          <p className="text-sm text-slate-500">
            심리상담을 단독으로 신청하면 카드 결제창이 열려요. 구속수용자 교육은 카드·계좌이체·가상계좌로
            결제할 수 있어요.
          </p>
        </Section>

        {/* 환불 */}
        <Section id="refund" eyebrow="Refund" title="환불 안내">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-6">
              <p className="flex items-center gap-2 font-extrabold text-emerald-800">
                <Undo2 className="h-5 w-5" /> 온라인으로 바로 신청
              </p>
              <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-slate-700">
                <Bullet>아직 수강을 시작하지 않은 강의 (수강 기간 내, 수료증 발급 전)</Bullet>
                <Bullet>아직 작성을 시작하지 않은 반성문·탄원서</Bullet>
              </ul>
              <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm leading-relaxed text-slate-600">
                <b>마이페이지 › 결제 내역</b>(또는 내 강의실)의 <b>환불 신청</b>을 누르세요. 함께 결제한 항목이
                여러 개면 <b>묶음 전체 환불 신청</b>도 할 수 있어요. 가상계좌로 결제했다면 환불받을 계좌를 함께
                적어 주세요.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="flex items-center gap-2 font-extrabold text-slate-800">
                <MessageSquare className="h-5 w-5" /> 1:1 문의로 요청
              </p>
              <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-slate-700">
                <Bullet>전문가 심리상담</Bullet>
                <Bullet>구속수용자 교육 (자료 발송 후에는 환불이 어려워요)</Bullet>
                <Bullet>결제 오류 등 그 밖의 경우</Bullet>
              </ul>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                강의를 이미 시작했거나 수료증을 받은 경우, 반성문·탄원서 작성을 시작한 경우에는 환불이
                어려워요.
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            환불이 처리되면 이메일로 알려 드려요. 카드 결제는 카드사 사정에 따라 취소 반영까지 3~7영업일이
            걸릴 수 있어요. 자세한 기준은{" "}
            <Link href="/terms" className="font-semibold text-slate-700 underline underline-offset-2">
              이용약관
            </Link>
            을 따릅니다.
          </p>
        </Section>

        {/* 저작권·개인정보 */}
        <Section id="etc" eyebrow="Policy" title="저작권 · 개인정보">
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard title="저작권">
              강의 영상, 학습 자료, 수료증·의견서 양식의 저작권은 (주)한국범죄예방교육센터에 있어요. 개인 양형자료
              제출 외 용도로 복제·배포할 수 없어요.
            </InfoCard>
            <InfoCard title="개인정보 보호">
              가입 정보와 설문·작성 답변은 서비스 운영 목적으로만 쓰고 외부에 공개하지 않아요. 개인정보
              관리책임자: 윤승진 (admin@kcpec.co.kr).{" "}
              <Link href="/privacy" className="font-semibold text-slate-700 underline underline-offset-2">
                개인정보처리방침
              </Link>
            </InfoCard>
          </div>
        </Section>

        {/* 문의 */}
        <div className="flex flex-col items-start gap-5 rounded-3xl bg-slate-900 p-7 text-white md:flex-row md:items-center md:justify-between md:p-9">
          <div>
            <p className="text-xl font-extrabold">더 궁금한 점이 있으신가요?</p>
            <p className="mt-1.5 text-sm text-slate-300">자주 묻는 질문을 먼저 보시거나, 편하게 문의해 주세요.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <Link
              href="/community?tab=faq"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-white px-5 text-sm font-bold text-slate-900 hover:bg-slate-100"
            >
              자주 묻는 질문
            </Link>
            <Link
              href="/mypage?tab=inquiry"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-white/25 px-5 text-sm font-bold text-white hover:bg-white/10"
            >
              <MessageSquare className="h-4 w-4" /> 1:1 문의
            </Link>
            <a
              href="tel:01063773325"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-white/25 px-5 text-sm font-bold text-white hover:bg-white/10"
            >
              <Phone className="h-4 w-4" /> 010-6377-3325
            </a>
            <a
              href="mailto:admin@kcpec.co.kr"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-white/25 px-5 text-sm font-bold text-white hover:bg-white/10"
            >
              <Mail className="h-4 w-4" /> 이메일
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    // scroll-mt: 목차로 이동했을 때 상단 고정 헤더에 제목이 가리지 않게
    <section id={id} className="scroll-mt-28 space-y-5">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-accent)]">{eyebrow}</p>
        <h2 className="mt-1 font-sans text-2xl font-extrabold text-slate-900 sm:text-[28px]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ProductSection({
  id,
  eyebrow,
  title,
  link,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  link: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-8 md:p-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-accent)]">{eyebrow}</p>
          <h2 className="mt-1 font-sans text-2xl font-extrabold text-slate-900 sm:text-[28px]">{title}</h2>
        </div>
        <Link
          href={link.href}
          className="inline-flex w-fit shrink-0 items-center gap-1 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-primary-hover)]"
        >
          {link.label} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function Steps({ steps }: { steps: { title: string; body: React.ReactNode }[] }) {
  return (
    <ol className="relative space-y-5">
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex gap-4">
          {i < steps.length - 1 ? (
            <span aria-hidden className="absolute left-[17px] top-10 h-[calc(100%-1.25rem)] w-px bg-slate-200" />
          ) : null}
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-extrabold text-white">
            {i + 1}
          </span>
          <div className="min-w-0 pt-1">
            <p className="font-extrabold text-slate-900">{s.title}</p>
            <p className="mt-1 text-[15px] leading-relaxed text-slate-600">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function MiniSteps({ items }: { items: string[] }) {
  return (
    <ol className="mt-4 space-y-2">
      {items.map((t, i) => (
        <li key={t} className="flex items-start gap-2.5 text-sm text-slate-700">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-extrabold text-emerald-700">
            {i + 1}
          </span>
          {t}
        </li>
      ))}
    </ol>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
      <span>{children}</span>
    </li>
  );
}

function Callout({ tone, children }: { tone: "amber" | "blue"; children: React.ReactNode }) {
  const cls =
    tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-100 bg-blue-50/70 text-slate-700";
  return <p className={`rounded-2xl border px-5 py-4 text-sm leading-relaxed ${cls}`}>{children}</p>;
}

function WhereBox({
  path,
  alt,
  img,
  caption,
}: {
  path: string[];
  alt?: string[];
  img?: { src: string; alt: string; w: number; h: number };
  caption?: string;
}) {
  return (
    <div className="rounded-3xl bg-slate-50 p-5 sm:p-6">
      <p className="text-xs font-extrabold text-slate-500">어디서 받나요?</p>
      <p className="mt-2 flex flex-wrap items-center gap-1.5">
        {path.map((p, i) => (
          <span key={p} className="inline-flex items-center gap-1.5">
            <span
              className={`rounded-lg px-2.5 py-1 text-sm font-bold ${
                i === path.length - 1 ? "bg-[var(--color-primary)] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
              }`}
            >
              {p}
            </span>
            {i < path.length - 1 ? <ChevronRight className="h-4 w-4 text-slate-400" /> : null}
          </span>
        ))}
      </p>
      {alt && alt.length ? (
        <p className="mt-3 text-sm text-slate-500">그 밖에: {alt.join(" · ")}</p>
      ) : null}
      {img ? <Shot src={img.src} alt={img.alt} w={img.w} h={img.h} caption={caption} className="mt-5" /> : null}
    </div>
  );
}

function Shot({
  src,
  alt,
  w,
  h,
  caption,
  className = "",
}: {
  src: string;
  alt: string;
  w: number;
  h: number;
  caption?: string;
  className?: string;
}) {
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} width={w} height={h} loading="lazy" className="h-auto w-full" />
      </div>
      {caption ? <figcaption className="mt-2 text-xs text-slate-400">{caption}</figcaption> : null}
    </figure>
  );
}

function InfoCard({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="flex items-center gap-2 font-extrabold text-slate-900">
        {icon ? <span className="text-[var(--color-accent)]">{icon}</span> : null}
        {title}
      </p>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{children}</p>
    </div>
  );
}
