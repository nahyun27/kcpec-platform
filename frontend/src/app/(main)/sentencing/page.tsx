"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  FileText,
  Loader2,
  Scale,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { getCourses, tokenStorage } from "@/lib/api";

// ---------- 강의 카탈로그 -----------------------------------------------------
//
// 가격은 backend courses.price(할인가 기준) 와 동기화 필요 — TODO: 클라이언트
// 확정가 변경 시 함께 갱신(backend/scripts/seed.py COURSES 참고).

type CourseId =
  | "law" // 준법의식 강화 (모든 경우 기본 포함)
  // ---- 메인 강의 (Page 1) ----
  | "drunk" // 음주운전 예방
  | "sex" // 성범죄 예방
  | "prostitution" // 성매매 예방
  | "digital_sex" // 디지털 성범죄 예방
  | "drug" // 마약 예방
  | "gambling" // 도박 및 도박개장 예방
  | "phishing" // 피싱범죄 예방
  | "property" // 사기횡령배임 등 재산범죄 예방
  | "stalking" // 스토킹범죄 예방
  | "school" // 학교폭력 예방
  | "violence" // 폭력범죄 예방교육
  | "youth" // 청소년범죄예방교육
  | "driving_habit" // 운전습관·도로교통법 교육
  | "defamation" // 명예훼손·모욕 예방 교육
  // ---- 추가 강의 (Page 2) ----
  | "anger" // 분노 조절·감정 통제 교육
  | "alcohol" // 알코올·중독 습관 교정 교육
  | "economy" // 경제 관념·사행성 방지 교육
  | "life_manners" // 생활예절교육
  | "digital_ethics" // 디지털 저작권·정보통신 윤리 교육
  | "privacy" // 개인정보 보호·사이버 금융 범죄 예방
  | "parenting" // 보호자 양육 윤리·예방 교육
  | "public_official" // 공무원 윤리 교육
  | "business_ethics" // 비즈니스·직장 내 윤리 교육
  | "org_school_ethics" // 단체·학교 내 윤리 교육
  // ---- 상담 (Page 3) ----
  | "counseling" // 심리상담 의견서 - 기본(서면) (독립 구매)
  | "counseling_phone"; // 심리상담 의견서 - 심화(전화) (독립 구매)

type CourseInfo = {
  id: CourseId;
  name: string;
  price: number;
};

const COURSES: Record<CourseId, CourseInfo> = {
  law: { id: "law", name: "준법의식 강화", price: 22_000 },

  drunk: { id: "drunk", name: "음주운전 예방", price: 55_000 },
  sex: { id: "sex", name: "성범죄 예방", price: 55_000 },
  prostitution: { id: "prostitution", name: "성매매 예방", price: 55_000 },
  digital_sex: { id: "digital_sex", name: "디지털 성범죄 예방", price: 55_000 },
  drug: { id: "drug", name: "마약 예방", price: 55_000 },
  gambling: { id: "gambling", name: "도박 및 도박개장 예방", price: 55_000 },
  phishing: { id: "phishing", name: "피싱범죄 예방", price: 55_000 },
  property: { id: "property", name: "사기횡령배임 등 재산범죄 예방", price: 55_000 },
  stalking: { id: "stalking", name: "스토킹범죄 예방", price: 55_000 },
  school: { id: "school", name: "학교폭력 예방", price: 55_000 },
  violence: { id: "violence", name: "폭력범죄 예방교육", price: 55_000 },
  youth: { id: "youth", name: "청소년범죄예방교육", price: 55_000 },
  driving_habit: { id: "driving_habit", name: "운전습관·도로교통법 교육", price: 55_000 },
  defamation: { id: "defamation", name: "명예훼손·모욕 예방 교육", price: 55_000 },

  anger: { id: "anger", name: "분노 조절·감정 통제 교육", price: 22_000 },
  alcohol: { id: "alcohol", name: "알코올·중독 습관 교정 교육", price: 22_000 },
  economy: { id: "economy", name: "경제 관념·사행성 방지 교육", price: 22_000 },
  life_manners: { id: "life_manners", name: "생활예절교육", price: 22_000 },
  digital_ethics: { id: "digital_ethics", name: "디지털 저작권·정보통신 윤리 교육", price: 33_000 },
  privacy: { id: "privacy", name: "개인정보 보호·사이버 금융 범죄 예방", price: 33_000 },
  parenting: { id: "parenting", name: "보호자 양육 윤리·예방 교육", price: 33_000 },
  public_official: { id: "public_official", name: "공무원 윤리 교육", price: 33_000 },
  business_ethics: { id: "business_ethics", name: "비즈니스·직장 내 윤리 교육", price: 33_000 },
  org_school_ethics: { id: "org_school_ethics", name: "단체·학교 내 윤리 교육", price: 33_000 },

  counseling: { id: "counseling", name: "심리상담 의견서(서면)", price: 77_000 },
  counseling_phone: { id: "counseling_phone", name: "심화 상담(전화)", price: 440_000 },
};

// ---------- Page 1: 메인 강의 --------------------------------------------------
// "기타" 는 특정 CourseId 로 매핑되지 않아 별도 boolean(etcSelected)으로 관리.

const MAIN_CARDS: { id: CourseId; description: string }[] = [
  { id: "drunk", description: "음주·약물 운전 적발" },
  { id: "sex", description: "성추행, 성폭력, 불법촬영 등" },
  { id: "prostitution", description: "성매매 알선·이용" },
  { id: "digital_sex", description: "불법촬영물 유포, 몰카, 딥페이크 등" },
  { id: "drug", description: "투약·소지·유통" },
  { id: "gambling", description: "도박·도박개장·사설사이트" },
  { id: "phishing", description: "보이스피싱, 대포통장 등" },
  { id: "property", description: "사기·횡령·배임 등 재산범죄" },
  { id: "stalking", description: "스토킹·접근금지 위반" },
  { id: "school", description: "교내 폭력·따돌림" },
  { id: "violence", description: "폭행, 상해 등 일반 폭력" },
  { id: "youth", description: "소년 사건, 청소년 재범방지" },
  { id: "driving_habit", description: "난폭운전, 도로교통법 위반" },
  { id: "defamation", description: "온·오프라인 명예훼손·모욕" },
];

// ---------- Page 2: 추가 강의 + 추천 알고리즘 ----------------------------------
//
// 메인 강의 선택 → 함께 준비하면 좋은 추가 강의를 추천 배지로 표시.
// (임상적/법적 근거가 아니라 사건 성격상 관련성이 높은 항목을 안내하는
// 참고용 추천이며, 최종 선택은 사용자가 직접 함.)

const ADDON_CARDS: { id: CourseId; description: string }[] = [
  { id: "anger", description: "분노·충동 조절 훈련 프로그램" },
  { id: "alcohol", description: "음주·약물 등 중독 습관 교정" },
  { id: "economy", description: "사행성 근절 및 준법 경제관념 확립" },
  { id: "life_manners", description: "사회생활 예절 및 대인관계 기본 소양" },
  { id: "digital_ethics", description: "디지털 저작권 및 정보통신 준법의식" },
  { id: "privacy", description: "개인정보 보호 및 사이버 금융범죄 예방" },
  { id: "parenting", description: "보호자로서의 양육 윤리 및 책임" },
  { id: "public_official", description: "공직자 윤리의식 및 청렴 실천" },
  { id: "business_ethics", description: "직장 내 괴롭힘 예방 및 조직문화" },
  { id: "org_school_ethics", description: "단체·학교 조직 내 윤리 규범" },
];

const RECOMMENDATIONS: Partial<Record<CourseId, CourseId[]>> = {
  drunk: ["alcohol"],
  digital_sex: ["digital_ethics", "privacy"],
  drug: ["alcohol"],
  gambling: ["economy"],
  phishing: ["privacy", "digital_ethics"],
  property: ["economy", "business_ethics"],
  stalking: ["anger"],
  school: ["anger", "org_school_ethics"],
  violence: ["anger"],
  youth: ["parenting", "org_school_ethics"],
  defamation: ["anger", "digital_ethics"],
};

// ---------- Page 3: 심리상담 Y/N -----------------------------------------------

const COUNSELING_QUESTION = "심리상담 의견서가 필요하신가요?";

// 프로모션: 활성(체크 해제 안 한) 강의 합계가 일정 금액 이상이면 정액 할인.
// TODO: 프로모션 종료/변경 시 이 두 값만 고치면 됨.
const BULK_DISCOUNT_THRESHOLD = 100_000;
const BULK_DISCOUNT_AMOUNT = 10_000;

// 심리상담 의견서 구매 시 "함께 제공"되는 부가 자료 — 결제 전이라 다운로드
// 링크는 없고, 어떤 게 포함되는지 안내용 목록으로만 노출.
const COUNSELING_BONUS_ITEMS = [
  "자기성찰 리포트",
  "교육이수 소감문",
  "CBT 기반 재범방지 자가진단 검사지",
  "맞춤형 양형자료 준비 가이드북",
];

// ---------- 페이지 ------------------------------------------------------------

type Step = 1 | 2 | 3 | 4;

export default function SentencingPage() {
  const router = useRouter();
  const [step, _setStep] = useState<Step>(1);
  function setStep(next: Step | ((s: Step) => Step)) {
    _setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Page 1
  const [selectedMain, setSelectedMain] = useState<Set<CourseId>>(new Set());
  const [etcSelected, setEtcSelected] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Page 2
  const [selectedAddon, setSelectedAddon] = useState<Set<CourseId>>(new Set());
  // Page 3
  const [counselingAnswer, setCounselingAnswer] = useState<"Y" | "N" | "">("");
  const [counselingType, setCounselingType] = useState<"basic" | "phone">("basic");
  // Page 4 — 개별 해제 (추천에서 빠지진 않고 회색 처리)
  const [disabledCourses, setDisabledCourses] = useState<Set<CourseId>>(
    new Set(),
  );

  // 뭔가 선택했거나 첫 단계를 넘어갔으면 "진행 중"으로 본다 — 이 상태에서
  // 새로고침/탭 닫기/다른 메뉴로 이동하면 전부 초기화되므로 확인창을 띄운다.
  const hasProgress = step > 1 || selectedMain.size > 0 || etcSelected;

  useEffect(() => {
    if (!hasProgress) return;

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);

    // 헤더 메뉴 등 앱 내부 링크 클릭은 beforeunload 가 안 걸리므로(SPA
    // 이동이라 실제 페이지 unload 가 아님) 클릭을 캡처 단계에서 가로채서
    // 직접 확인창을 띄운다.
    function handleClickCapture(e: MouseEvent) {
      const anchor = (e.target as HTMLElement | null)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!anchor) return;
      if (
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.origin !== window.location.origin ||
        anchor.pathname === window.location.pathname
      ) {
        return;
      }
      const confirmed = window.confirm(
        "지금 나가시면 선택하신 내용이 모두 초기화됩니다. 이동하시겠습니까?",
      );
      if (!confirmed) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    document.addEventListener("click", handleClickCapture, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClickCapture, true);
    };
  }, [hasProgress]);

  // 강의가 선택 목록에서 완전히 빠질 때, Page4 에서 남아있던 개별 해제
  // 기록도 같이 지운다. 안 지우면: (1)해제 → (2)Page1/2 에서 그 강의를
  // 선택 해제했다가 다시 선택 → (3)방금 새로 고른 강의인데 사이드바엔
  // 예전 해제 기록 때문에 비활성으로 나오는 버그가 생김.
  function pruneDisabled(id: CourseId) {
    setDisabledCourses((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggleMain(id: CourseId) {
    setSelectedMain((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        pruneDisabled(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAddon(id: CourseId) {
    setSelectedAddon((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        pruneDisabled(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function answerCounseling(val: "Y" | "N") {
    setCounselingAnswer(val);
    if (val === "N") {
      pruneDisabled("counseling");
      pruneDisabled("counseling_phone");
    }
  }

  function selectCounselingType(type: "basic" | "phone") {
    setCounselingType(type);
    // 상담 종류를 바꾸면 이전 종류에 남아있던 Page4 개별 해제 기록이
    // 새 종류로 잘못 이어붙는 걸 방지 (pruneDisabled 패턴과 동일한 이유).
    pruneDisabled(type === "phone" ? "counseling" : "counseling_phone");
  }

  function toggleCourse(id: CourseId) {
    setDisabledCourses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 메인 강의 선택 기준 추천 추가 강의
  const recommendedAddonIds = useMemo(() => {
    const s = new Set<CourseId>();
    selectedMain.forEach((k) => (RECOMMENDATIONS[k] ?? []).forEach((a) => s.add(a)));
    return s;
  }, [selectedMain]);

  // 지금 선택 상태 기준으로 실제 포함되는 강의 id 집합.
  const currentCourseIds = useMemo(() => {
    const s = new Set<CourseId>(["law"]); // 준법의식 항상 포함
    selectedMain.forEach((k) => s.add(k));
    selectedAddon.forEach((k) => s.add(k));
    if (counselingAnswer === "Y") {
      s.add(counselingType === "phone" ? "counseling_phone" : "counseling");
    }
    return s;
  }, [selectedMain, selectedAddon, counselingAnswer, counselingType]);

  // 추천 결과 계산
  const recommendation = useMemo(() => {
    const courses = Array.from(currentCourseIds).map((id) => COURSES[id]);
    const activeCourses = courses.filter((c) => !disabledCourses.has(c.id));
    // 강의당 "수료증 + 서약서" 1세트 생성. 심리상담 의견서만 별도 표기.
    const docs = courses.map((c) => ({
      name: c.id === "counseling" || c.id === "counseling_phone" ? c.name : `${c.name} 수료증 + 서약서`,
      active: !disabledCourses.has(c.id),
    }));
    const subtotal = activeCourses.reduce((sum, c) => sum + c.price, 0);
    const discount = subtotal >= BULK_DISCOUNT_THRESHOLD ? BULK_DISCOUNT_AMOUNT : 0;
    const total = subtotal - discount;
    return {
      courses,
      documents: docs,
      subtotal,
      discount,
      total,
      activeCourseCount: activeCourses.length,
    };
  }, [currentCourseIds, disabledCourses]);

  async function handleCheckout() {
    if (recommendation.activeCourseCount === 0) return;
    if (!tokenStorage.getAccess()) {
      router.push(
        `/login?next=${encodeURIComponent("/sentencing")}`,
      );
      return;
    }

    // 심리상담(counseling/counseling_phone)은 일반 강의와 다른 별도 구매
    // 플로우(설문 제출 등)를 타고 있어 이 묶음결제에 함께 담지 않는다 — 선택돼
    // 있으면 /counseling 에서 별도로 진행해야 한다는 걸 먼저 안내한다.
    const regularCourses = recommendation.courses.filter(
      (c) =>
        !disabledCourses.has(c.id) &&
        c.id !== "counseling" &&
        c.id !== "counseling_phone",
    );
    const counselingSelected = recommendation.courses.some(
      (c) =>
        !disabledCourses.has(c.id) &&
        (c.id === "counseling" || c.id === "counseling_phone"),
    );

    if (regularCourses.length === 0) {
      if (counselingSelected) router.push("/counseling");
      return;
    }

    setCheckoutError(null);
    setCheckingOut(true);
    try {
      // sentencing 페이지의 CourseId(문자열 키)는 실제 DB course_id 와 별개라
      // (여기 코드 상단 주석 참고) 실제 결제로 넘어가려면 강의명으로 매칭해
      // 진짜 course_id 를 알아내야 한다.
      const realCourses = await getCourses();
      const byTitle = new Map(realCourses.map((c) => [c.title, c.id]));
      const resolvedIds = regularCourses
        .map((c) => byTitle.get(c.name))
        .filter((id): id is number => typeof id === "number");

      if (resolvedIds.length !== regularCourses.length) {
        setCheckoutError("일부 강의 정보를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      if (counselingSelected) {
        window.alert(
          "심리상담 의견서는 이 결제에 포함되지 않습니다. 강의 결제 후 전문가 심리상담 페이지에서 별도로 신청해 주세요.",
        );
      }

      router.push(`/checkout/bundle?courses=${resolvedIds.join(",")}`);
    } catch {
      setCheckoutError("강의 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setCheckingOut(false);
    }
  }

  const canGoNext = step === 1 ? selectedMain.size > 0 || etcSelected : true;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-48 lg:pb-24 animate-in fade-in duration-300">
      {/* 모바일: 제목만 간결하게 / 데스크톱: 풀 헤더 */}
      <div className="bg-white relative z-10 border-b border-slate-100">
        {/* 모바일 컴팩트 헤더 */}
        <div className="px-4 py-3 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-sans text-lg font-extrabold text-slate-900">
              맞춤 강의 찾기
            </h1>
            <StepIndicator step={step} compact />
          </div>
          <p className="mt-1 text-sm leading-snug text-slate-500">
            사건 유형을 선택하시면 필요한 강의와 발급 가능한 서류를 안내해 드립니다.
          </p>
        </div>
        {/* 데스크톱 풀 헤더 */}
        <div className="hidden md:block pt-12">
          <div className="mx-auto max-w-5xl px-6">
            <PageHeader
              title="맞춤 강의 찾기"
              subtitle="Find your course"
              icon={<Scale className="h-3.5 w-3.5" />}
              description="사건 유형을 선택하시면 필요한 강의와 발급 가능한 서류를 자동으로 안내해 드립니다."
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-3 md:pt-8">
        {/* 데스크톱 전용 진행 표시 (모바일은 헤더에 inline) */}
        <div className="hidden md:block">
          <StepIndicator step={step} />
        </div>

        {step !== 4 ? (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-accent)]/20 bg-gradient-to-r from-blue-50 to-amber-50 px-5 py-3.5 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-sm font-medium text-slate-600">
              마지막 단계(추천 결과)에서 예상 금액을 확인하실 수 있어요.
            </p>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-3.5 py-1.5 text-sm font-bold text-white shadow-sm">
              10만원 이상 구매 시 10,000원 할인
            </span>
          </div>
        ) : null}

        {/* Step 본문 */}
        <div className="mt-3 md:mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            {step === 1 ? (
              <Step1
                selectedMain={selectedMain}
                etcSelected={etcSelected}
                onToggleMain={toggleMain}
                onToggleEtc={() => setEtcSelected((v) => !v)}
              />
            ) : null}
            {step === 2 ? (
              <Step2
                selectedAddon={selectedAddon}
                recommendedIds={recommendedAddonIds}
                onToggleAddon={toggleAddon}
                etcOnly={etcSelected && selectedMain.size === 0}
              />
            ) : null}
            {step === 3 ? (
              <Step3Counseling
                answer={counselingAnswer}
                onAnswer={answerCounseling}
                counselingType={counselingType}
                onSelectType={selectCounselingType}
              />
            ) : null}
            {step === 4 ? (
              <Step4Result
                recommendation={recommendation}
                disabledCourses={disabledCourses}
                onToggleCourse={toggleCourse}
              />
            ) : null}

            {/* 네비게이션 */}
            {/* 네비 — 데스크톱만 (모바일은 하단 fixed bar) */}
            <div className="hidden items-center justify-between gap-3 pt-2 lg:flex">
              <button
                type="button"
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
                disabled={step === 1}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" /> 이전
              </button>
              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => ((s + 1) as Step))}
                  disabled={!canGoNext}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1C3461] px-6 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] disabled:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0"
                >
                  다음 <ArrowRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {/* 우측 sticky 카트 (Page 4 에서 의미 있음 — 1~3 에서는 미리보기 가이드) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <CartSummary
                recommendation={recommendation}
                disabledCourses={disabledCourses}
                step={step}
                onCheckout={handleCheckout}
                checkingOut={checkingOut}
              />
            </div>
          </aside>
        </div>
      </div>

      {/* 모바일: 하단 고정 — 발급 가능 서류 패널 + 네비/체크아웃 바 */}
      <div className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
        {/* 발급 가능 서류 패널 — 항상 노출 (선택 전엔 안내 문구) */}
        <div className="border-t border-zinc-200 bg-slate-50/95 px-4 py-2.5 backdrop-blur">
          <div className="mx-auto max-w-5xl">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <FileText className="h-3 w-3 text-[#1C3461]" />
              발급 가능 서류
              {recommendation.documents.length > 0 ? (
                <span className="font-mono text-slate-500">
                  (
                  {recommendation.documents.filter((d) => d.active).length +
                    (recommendation.courses.some(
                      (c) =>
                        (c.id === "counseling" || c.id === "counseling_phone") &&
                        !disabledCourses.has(c.id),
                    )
                      ? COUNSELING_BONUS_ITEMS.length
                      : 0)}
                  개)
                </span>
              ) : null}
            </div>
            {recommendation.documents.length === 0 ? (
              <p className="text-xs text-slate-400">
                사건 유형을 선택하시면 발급 가능한 서류가 표시됩니다.
              </p>
            ) : (
              <ul className="flex max-h-20 flex-col gap-1 overflow-y-auto pr-1">
                {recommendation.documents.map((d) => (
                  <li
                    key={d.name}
                    className={`flex items-start gap-1.5 text-xs leading-snug ${
                      d.active ? "text-slate-700" : "text-slate-400 line-through"
                    }`}
                  >
                    <Check
                      className={`mt-0.5 h-3 w-3 shrink-0 ${
                        d.active ? "text-[#1C3461]" : "text-slate-300"
                      }`}
                    />
                    <span className="truncate">{d.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 네비/체크아웃 바 */}
        <div className="border-t border-zinc-200 bg-white px-4 py-3 shadow-2xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
              disabled={step === 1}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm disabled:opacity-30"
            >
              <ArrowLeft className="h-4 w-4" /> 이전
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => ((s + 1) as Step))}
                disabled={!canGoNext}
                className="inline-flex items-center gap-1 rounded-full bg-[#1C3461] px-5 py-2 text-sm font-bold text-white shadow-md disabled:opacity-40"
              >
                다음 <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-500">합계</p>
                  {recommendation.discount > 0 && (
                    <p className="text-xs font-medium text-slate-400 line-through">
                      {recommendation.subtotal.toLocaleString()}원
                    </p>
                  )}
                  <p className="text-lg font-extrabold text-[#1C3461]">
                    {recommendation.total.toLocaleString()}원
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={recommendation.activeCourseCount === 0 || checkingOut}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1C3461] px-4 py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-40"
                >
                  {checkingOut ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> 이동 중...
                    </>
                  ) : (
                    "수강 신청 →"
                  )}
                </button>
              </div>
            )}
          </div>
          {checkoutError ? (
            <p className="mx-auto mt-2 max-w-5xl text-right text-sm font-semibold text-red-600">
              {checkoutError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------- 진행 표시 --------------------------------------------------------

function StepIndicator({
  step,
  compact = false,
}: {
  step: Step;
  compact?: boolean;
}) {
  const items = [
    { n: 1, label: "메인 강의" },
    { n: 2, label: "추가 강의" },
    { n: 3, label: "심리상담" },
    { n: 4, label: "결제" },
  ];

  // compact: 모바일 헤더 인라인용 — 작은 원 + 짧은 연결선, 라벨 없음
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {items.map((it, i) => {
          const active = step === it.n;
          const done = step > it.n;
          return (
            <div key={it.n} className="flex items-center gap-1.5">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                  done || active
                    ? "bg-[#1C3461] text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : it.n}
              </div>
              {i < items.length - 1 ? (
                <div
                  className={`h-0.5 w-3 ${
                    step > it.n ? "bg-[#1C3461]" : "bg-slate-200"
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4">
      {items.map((it, i) => {
        const active = step === it.n;
        const done = step > it.n;
        return (
          <div key={it.n} className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  done
                    ? "bg-[#1C3461] text-white"
                    : active
                      ? "bg-[#1C3461] text-white shadow-md"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : it.n}
              </div>
              <span
                className={`hidden text-sm font-bold sm:inline ${
                  active ? "text-[#1C3461]" : done ? "text-slate-600" : "text-slate-400"
                }`}
              >
                {it.label}
              </span>
            </div>
            {i < items.length - 1 ? (
              <div
                className={`h-0.5 w-6 sm:w-16 ${
                  step > it.n ? "bg-[#1C3461]" : "bg-slate-200"
                }`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Page 1: 메인 강의 선택 -------------------------------------------

function Step1({
  selectedMain,
  etcSelected,
  onToggleMain,
  onToggleEtc,
}: {
  selectedMain: Set<CourseId>;
  etcSelected: boolean;
  onToggleMain: (id: CourseId) => void;
  onToggleEtc: () => void;
}) {
  return (
    <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm md:p-7">
      <h2 className="font-sans text-lg font-extrabold text-slate-900 sm:text-xl">
        어떤 사건으로 오셨나요?
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        해당되는 항목을 모두 선택해 주세요. (복수 선택 가능)
      </p>

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {MAIN_CARDS.map((card) => {
          const course = COURSES[card.id];
          const active = selectedMain.has(card.id);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onToggleMain(card.id)}
              className={`relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                active
                  ? "border-[#1C3461] bg-[#1C3461]/5 shadow-sm"
                  : "border-zinc-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  active
                    ? "border-[#1C3461] bg-[#1C3461]"
                    : "border-slate-300 bg-white"
                }`}
              >
                {active ? <Check className="h-2.5 w-2.5 text-white" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`font-sans text-[15px] font-bold ${
                    active ? "text-[#1C3461]" : "text-slate-900"
                  }`}
                >
                  {course.name}
                </p>
                <p className="mt-0.5 text-[13px] text-slate-500 truncate">
                  {card.description}
                </p>
              </div>
            </button>
          );
        })}

        {/* 기타 — 특정 강의로 매핑되지 않는 사건 */}
        <button
          type="button"
          onClick={onToggleEtc}
          className={`relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
            etcSelected
              ? "border-[#1C3461] bg-[#1C3461]/5 shadow-sm"
              : "border-zinc-200 bg-white hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <div
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
              etcSelected
                ? "border-[#1C3461] bg-[#1C3461]"
                : "border-slate-300 bg-white"
            }`}
          >
            {etcSelected ? <Check className="h-2.5 w-2.5 text-white" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`font-sans text-[15px] font-bold ${
                etcSelected ? "text-[#1C3461]" : "text-slate-900"
              }`}
            >
              기타
            </p>
            <p className="mt-0.5 text-[13px] text-slate-500 truncate">
              위 항목에 해당하지 않는 사건
            </p>
          </div>
        </button>
      </div>

      {selectedMain.size === 0 && !etcSelected ? (
        <p className="mt-4 text-sm text-slate-400">
          1개 이상 선택하시면 다음 단계로 진행할 수 있습니다.
        </p>
      ) : null}
    </section>
  );
}

// ---------- Page 2: 추가 강의 선택 (추천 배지) --------------------------------

function Step2({
  selectedAddon,
  recommendedIds,
  onToggleAddon,
  etcOnly,
}: {
  selectedAddon: Set<CourseId>;
  recommendedIds: Set<CourseId>;
  onToggleAddon: (id: CourseId) => void;
  // Page1 에서 "기타"만 선택(메인 강의는 하나도 안 고름) — 이 경우 여기가
  // "추가 교육"이 아니라 사실상 본인 사건에 맞는 강의를 직접 고르는
  // 자리이므로 문구를 다르게 안내한다.
  etcOnly: boolean;
}) {
  return (
    <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm md:p-7">
      <h2 className="font-sans text-lg font-extrabold text-slate-900 sm:text-xl">
        {etcOnly ? "해당하는 교육을 선택해 주세요" : "추가로 필요한 교육이 있어요"}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {etcOnly ? (
          "메인 강의 목록에 해당하는 사건이 없으셨군요. 아래 강의 중 사건과 관련 있는 항목을 자유롭게 선택해 주세요."
        ) : recommendedIds.size > 0 ? (
          <>
            선택하신 사건에 따라{" "}
            <span className="font-semibold text-[#1C3461]">추천</span> 배지가
            표시됩니다. 필요한 항목을 자유롭게 선택해 주세요.
          </>
        ) : (
          "해당하는 사건에 맞는 추천 항목은 없지만, 필요하신 항목을 자유롭게 선택해 주세요."
        )}{" "}
        (복수 선택 가능, 선택하지 않아도 다음 단계로 진행 가능)
      </p>

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ADDON_CARDS.map((card) => {
          const course = COURSES[card.id];
          const active = selectedAddon.has(card.id);
          const recommended = recommendedIds.has(card.id);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onToggleAddon(card.id)}
              className={`relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                active
                  ? "border-[#1C3461] bg-[#1C3461]/5 shadow-sm"
                  : recommended
                    ? "border-amber-300 bg-amber-50/50 hover:border-amber-400"
                    : "border-zinc-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  active
                    ? "border-[#1C3461] bg-[#1C3461]"
                    : "border-slate-300 bg-white"
                }`}
              >
                {active ? <Check className="h-2.5 w-2.5 text-white" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p
                    className={`font-sans text-[15px] font-bold ${
                      active ? "text-[#1C3461]" : "text-slate-900"
                    }`}
                  >
                    {course.name}
                  </p>
                  {recommended ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold text-white">
                      <Sparkles className="h-2.5 w-2.5" /> 추천
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[13px] text-slate-500 truncate">
                  {card.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------- Page 3: 심리상담 Y/N ----------------------------------------------

const COUNSELING_TYPE_OPTIONS: {
  type: "basic" | "phone";
  label: string;
  desc: string;
}[] = [
  {
    type: "basic",
    label: "전문가 심리상담 (서면)",
    desc: "온라인 설문 기반 · 77,000원",
  },
  {
    type: "phone",
    label: "심화 상담 (전화)",
    desc: "회당 20분 × 4회 · 440,000원",
  },
];

function Step3Counseling({
  answer,
  onAnswer,
  counselingType,
  onSelectType,
}: {
  answer: "Y" | "N" | "";
  onAnswer: (val: "Y" | "N") => void;
  counselingType: "basic" | "phone";
  onSelectType: (type: "basic" | "phone") => void;
}) {
  const [explainerOpen, setExplainerOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm md:p-7">
      <h2 className="font-sans text-lg font-extrabold text-slate-900 sm:text-xl">
        마지막으로 한 가지만 확인할게요
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        전문가 심리상담 의견서는 사건 유형과 무관하게 신청하실 수 있습니다.
      </p>

      <div className="mt-5 rounded-xl border border-zinc-100 bg-slate-50/40 p-3.5">
        <p className="text-sm font-bold text-slate-800">
          {COUNSELING_QUESTION}
        </p>
        <div className="mt-2.5 flex gap-2">
          {(["Y", "N"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onAnswer(opt)}
              className={`min-w-[70px] rounded-lg px-4 py-1.5 text-sm font-bold transition-all ${
                answer === opt
                  ? "bg-[#1C3461] text-white shadow-sm"
                  : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              {opt === "Y" ? "예" : "아니오"}
            </button>
          ))}
        </div>

        {answer === "Y" ? (
          <div className="mt-3.5 border-t border-zinc-100 pt-3.5">
            <p className="text-sm font-bold text-slate-600">
              어떤 방식으로 상담받으실래요?
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {COUNSELING_TYPE_OPTIONS.map((opt) => {
                const active = counselingType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => onSelectType(opt.type)}
                    className={`rounded-lg border p-3 text-left transition-all ${
                      active
                        ? "border-[#1C3461] bg-[#1C3461]/5 ring-1 ring-[#1C3461]"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <p
                      className={`text-sm font-bold ${
                        active ? "text-[#1C3461]" : "text-slate-800"
                      }`}
                    >
                      {opt.label}
                    </p>
                    <p className="mt-0.5 text-[13px] text-slate-500">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExplainerOpen((v) => !v)}
            className="text-sm font-medium text-[#1C3461] underline-offset-2 hover:underline"
          >
            심리상담 의견서란? {explainerOpen ? "▲" : "▼"}
          </button>
          {explainerOpen ? (
            <div className="mt-2 rounded-lg bg-blue-50 p-4 text-sm leading-relaxed text-slate-700">
              <p>
                심리상담 의견서는 전문 심리상담사가 작성하는 법원 제출용
                공식 문서입니다.
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                <li>
                  • 내담자의 심리 상태, 반성 정도, 재범 방지 계획을
                  전문가 소견으로 기술
                </li>
                <li>
                  • 판사에게 피고인의 변화 의지를 전달하는 핵심 양형자료
                </li>
                <li>• 전문 심리상담사의 작성 및 검수를 거쳐 발급</li>
                <li>• 발급까지 1~2 영업일 소요</li>
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ---------- Page 4: 추천 결과 + 결제 ------------------------------------------

type Recommendation = {
  courses: CourseInfo[];
  documents: { name: string; active: boolean }[];
  subtotal: number;
  discount: number;
  total: number;
  activeCourseCount: number;
};

function Step4Result({
  recommendation,
  disabledCourses,
  onToggleCourse,
}: {
  recommendation: Recommendation;
  disabledCourses: Set<CourseId>;
  onToggleCourse: (id: CourseId) => void;
}) {
  const hasDisabled = disabledCourses.size > 0;
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-4 flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-[var(--color-accent)]" />
          <h2 className="font-sans text-xl font-extrabold text-slate-900 sm:text-2xl">
            추천 교육 과정
          </h2>
        </div>
        <ul className="divide-y divide-zinc-100">
          {recommendation.courses.map((c) => {
            const active = !disabledCourses.has(c.id);
            return (
              <li key={c.id} className="py-3">
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => onToggleCourse(c.id)}
                      className="h-4 w-4 shrink-0 accent-[#1C3461]"
                    />
                    <span
                      className={`truncate text-sm font-semibold ${
                        active ? "text-slate-900" : "text-slate-400 line-through"
                      }`}
                    >
                      {c.name}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 font-mono text-sm font-bold ${
                      active ? "text-slate-900" : "text-slate-400 line-through"
                    }`}
                  >
                    {c.price.toLocaleString()}원
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {hasDisabled ? (
          <p className="mt-3 text-sm font-medium text-amber-600">
            추천 강의를 해제하면 해당 수료증이 발급되지 않습니다.
          </p>
        ) : null}
        <p className="mt-4 text-sm text-slate-500">
          * 수료증은 결제 후 강의를 수료(진도+퀴즈 통과)하면 발급됩니다.
        </p>
      </div>

    </section>
  );
}

// ---------- 우측 카트 카드 ----------------------------------------------------

function CartSummary({
  recommendation,
  disabledCourses,
  step,
  onCheckout,
  checkingOut,
}: {
  recommendation: Recommendation;
  disabledCourses: Set<CourseId>;
  step: Step;
  onCheckout: () => void;
  checkingOut: boolean;
}) {
  const noneSelected = recommendation.activeCourseCount === 0;
  const counselingActive = recommendation.courses.some(
    (c) =>
      (c.id === "counseling" || c.id === "counseling_phone") &&
      !disabledCourses.has(c.id),
  );
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-md shadow-slate-200/40">
      <h3 className="font-sans text-lg font-extrabold tracking-tight text-slate-900">
        추천 강의
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        선택하신 사건에 따른 추천 강의입니다.
      </p>

      <ul
        className={`mt-5 space-y-3 ${
          step === 4 ? "border-b border-zinc-100 pb-5" : "pb-1"
        }`}
      >
        {recommendation.courses.length === 0 ? (
          <li className="text-sm text-slate-400">아직 선택된 과정이 없습니다.</li>
        ) : (
          recommendation.courses.map((c) => {
            const active = !disabledCourses.has(c.id);
            return (
              <li key={c.id} className="flex items-center gap-2.5">
                <Check
                  className={`h-4 w-4 shrink-0 ${
                    active ? "text-[#1C3461]" : "text-slate-300"
                  }`}
                />
                <span
                  className={`min-w-0 flex-1 truncate text-[15px] font-medium ${
                    active ? "text-slate-800" : "text-slate-400 line-through"
                  }`}
                >
                  {c.name}
                </span>
                {step === 4 ? (
                  <span
                    className={`shrink-0 font-mono text-[15px] font-bold ${
                      active ? "text-slate-700" : "text-slate-400 line-through"
                    }`}
                  >
                    {c.price.toLocaleString()}원
                  </span>
                ) : null}
              </li>
            );
          })
        )}
      </ul>

      {/* 결제 직전 가장 먼저 눈에 들어와야 하는 정보라 카드로 강조.
          발급 서류 안내는 아래로 내리고 톤을 낮춰 금액과 경쟁하지 않게 함.
          1~3단계 안내/할인 문구는 페이지 상단 배너로 옮겨서 여기선 4단계에서만 노출. */}
      {step === 4 ? (
        <>
          <div className="mt-5 rounded-xl bg-slate-50 p-5">
            {recommendation.discount > 0 && (
              <div className="flex items-center justify-between text-[15px] text-slate-400">
                <span>상품 금액</span>
                <span className="line-through">
                  {recommendation.subtotal.toLocaleString()}원
                </span>
              </div>
            )}
            {recommendation.discount > 0 && (
              <div className="mt-1.5 flex items-center justify-between text-[15px] font-bold text-[var(--color-accent)]">
                <span>10만원 이상 할인</span>
                <span>-{recommendation.discount.toLocaleString()}원</span>
              </div>
            )}
            <div
              className={`flex flex-col gap-1 ${
                recommendation.discount > 0
                  ? "mt-3 border-t border-dashed border-zinc-200 pt-3"
                  : ""
              }`}
            >
              <span className="text-sm font-bold text-slate-600">합계</span>
              <span className="font-sans text-[28px] font-black leading-tight text-[#1C3461]">
                {recommendation.total.toLocaleString()}
                <span className="ml-1 text-base font-bold text-slate-500">원</span>
              </span>
            </div>
            {recommendation.discount === 0 && (
              <p className="mt-3 text-sm font-medium text-[var(--color-accent)]">
                💡 10만원 이상 구매 시 10,000원 할인이 자동 적용돼요.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onCheckout}
            disabled={noneSelected || checkingOut}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#1C3461] py-3.5 text-base font-bold text-white shadow-md shadow-[#1C3461]/20 transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] disabled:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {checkingOut ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> 이동 중...
              </>
            ) : (
              "수강신청하기"
            )}
          </button>
          {noneSelected ? (
            <p className="mt-2 text-center text-sm font-medium text-amber-600">
              최소 1개 이상의 강의를 선택해 주세요.
            </p>
          ) : null}
        </>
      ) : null}

      {/* 발급 가능 서류 — 참고 정보로, 금액/CTA 보다 톤 다운해서 맨 아래 배치 */}
      <div className="mt-6 border-t border-zinc-100 pt-5">
        <p className="flex items-center gap-2 text-base font-bold text-slate-700">
          <FileText className="h-4 w-4 text-slate-400" />
          발급 가능 서류
          {recommendation.documents.length > 0 ? (
            <span className="font-mono text-sm font-medium text-slate-400">
              (
              {recommendation.documents.filter((d) => d.active).length +
                (counselingActive ? COUNSELING_BONUS_ITEMS.length : 0)}
              개)
            </span>
          ) : null}
        </p>
        {recommendation.documents.length === 0 ? (
          <p className="mt-2.5 text-sm text-slate-400">
            강의를 선택하면 발급 서류가 표시됩니다.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {recommendation.documents.map((d) => (
              <li
                key={d.name}
                className={`flex items-start gap-2 text-sm leading-relaxed ${
                  d.active ? "text-slate-600" : "text-slate-300 line-through"
                }`}
              >
                <Check
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                    d.active ? "text-[#1C3461]" : "text-slate-300"
                  }`}
                />
                {d.name}
              </li>
            ))}
            {counselingActive
              ? COUNSELING_BONUS_ITEMS.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm leading-relaxed text-slate-600"
                  >
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1C3461]" />
                    {item}
                  </li>
                ))
              : null}
          </ul>
        )}
      </div>
    </div>
  );
}
