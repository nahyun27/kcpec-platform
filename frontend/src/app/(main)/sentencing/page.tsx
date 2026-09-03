"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ClipboardList,
  FileText,
  Scale,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { tokenStorage } from "@/lib/api";

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
  | "counseling"; // 심리상담 의견서 (독립 구매)

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

  counseling: { id: "counseling", name: "심리상담 의견서", price: 77_000 },
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

// 심리상담 의견서 구매 시 "함께 제공"되는 부가 자료 — 결제 전이라 다운로드
// 링크는 없고, 어떤 게 포함되는지 안내용 목록으로만 노출.
const COUNSELING_BONUS_ITEMS = [
  "자기성찰 리포트",
  "교육이수 소감문",
  "CBT 기반 재범방지 자가진단 검사지",
  "맞춤형 양형자료 준비 가이드북",
];

// ---------- 준비 서류 체크리스트 (양형자료 준비 가이드북 Ⅶ장 기준) -----------

type ChecklistGroup = {
  key: string;
  label: string;
  trigger: (selectedMain: Set<CourseId>) => boolean;
  items: string[];
};

const CHECKLIST_GROUPS: ChecklistGroup[] = [
  {
    key: "common",
    label: "공통",
    trigger: () => true,
    items: [
      "사건일지",
      "반성문(자필)",
      "자기성찰 리포트·교육이수 소감문",
      "탄원서(가족·지인 등)",
      "합의서·처벌불원서·공탁 내역",
      "가족관계증명서·주민등록등본",
      "가족 구성원 모두가 나온 사진 2~3장",
      "재직·사업·급여 등 직업 소명자료",
      "학업·표창·상장 등",
      "봉사활동 확인서·기부 내역",
      "정신건강의학과 등 진료·상담 기록",
      "기타 유리하다고 생각되는 모든 자료",
    ],
  },
  {
    key: "drunk",
    label: "운전·음주 관련",
    trigger: (s) => s.has("drunk") || s.has("driving_habit"),
    items: [
      "운전 관련 교육 이수증",
      "교통법규 위반사실 조회(무위반 캡처)",
      "사건 당일 대리운전 호출·배차 내역",
      "평소 대리기사 이용 기록",
      "사건 이후 대중교통 이용내역",
      "차량 처분(양도·매각·반환) 증빙",
      "운전의 생계 영향 소명자료",
      "CBT 기반 재범방지 자가진단 검사지",
    ],
  },
  {
    key: "violence_property",
    label: "폭력·재산 등",
    trigger: (s) =>
      ["violence", "stalking", "school", "property", "gambling"].some((k) =>
        s.has(k as CourseId),
      ),
    items: [
      "분노조절·심리상담 이수/진행 기록",
      "피해 변제·배상·공탁 내역",
      "신용회복·금융교육 이수 내역",
      "재발방지 서약 및 실천 계획",
    ],
  },
];

const CHECKLIST_STORAGE_KEY = "kcpec_sentencing_checklist_v1";

function PrepChecklist({ selectedMain }: { selectedMain: Set<CourseId> }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  // 로컬 저장값 복원 — 브라우저별 개인 체크 진행상황이라 서버 저장 없이 localStorage만 사용.
  // (SSR 시 window 가 없으므로 마운트 후 useEffect 에서 읽어야 함)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (raw) setChecked(new Set(JSON.parse(raw) as string[]));
    } catch {
      // 프라이빗 브라우징 등으로 접근 불가 — 무시하고 빈 상태로 시작
    } finally {
      setHydrated(true);
    }
  }, []);

  function toggleItem(itemKey: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      try {
        window.localStorage.setItem(
          CHECKLIST_STORAGE_KEY,
          JSON.stringify(Array.from(next)),
        );
      } catch {
        // 저장 실패해도 화면상 체크는 유지 — 새로고침 시에만 못 살아남음
      }
      return next;
    });
  }

  const groups = CHECKLIST_GROUPS.filter((g) => g.trigger(selectedMain));
  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);
  const totalChecked = groups.reduce(
    (sum, g) =>
      sum + g.items.filter((item) => checked.has(`${g.key}:${item}`)).length,
    0,
  );

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-[var(--color-accent)]" />
          <h2 className="font-sans text-xl font-extrabold text-slate-900 sm:text-2xl">
            내가 직접 준비할 서류
          </h2>
        </div>
        {hydrated ? (
          <span className="font-mono text-sm font-bold text-slate-500">
            {totalChecked}/{totalItems}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        위 강의·상담은 KCPEC이 발급하는 자료이고, 아래 항목들은 선택하신
        사건 유형에 맞춰 본인이 직접 모아야 하는 양형자료입니다. 준비되는
        대로 체크해 보세요 — 이 진행 상황은 이 브라우저에만 저장됩니다.
      </p>

      <div className="mt-6 space-y-6">
        {groups.map((g) => {
          const groupChecked = g.items.filter((item) =>
            checked.has(`${g.key}:${item}`),
          ).length;
          return (
            <div key={g.key}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">{g.label}</h3>
                <span className="font-mono text-xs text-slate-400">
                  {groupChecked}/{g.items.length}
                </span>
              </div>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {g.items.map((item) => {
                  const itemKey = `${g.key}:${item}`;
                  const active = checked.has(itemKey);
                  return (
                    <li key={itemKey}>
                      <button
                        type="button"
                        onClick={() => toggleItem(itemKey)}
                        className={`flex w-full items-start gap-2 rounded-lg border p-2.5 text-left text-[13px] transition-colors ${
                          active
                            ? "border-[#1C3461]/30 bg-[#1C3461]/5 text-slate-500 line-through"
                            : "border-zinc-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            active
                              ? "border-[#1C3461] bg-[#1C3461]"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {active ? (
                            <Check className="h-2.5 w-2.5 text-white" />
                          ) : null}
                        </div>
                        <span>{item}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-slate-400">
        본 체크리스트는 일반적인 정보 제공을 목적으로 하며, 개별 사건에 대한
        법률 자문이 아닙니다. 구체적인 사안은 담당 변호사 등 전문가와
        상담하시기 바랍니다.
      </p>
    </section>
  );
}

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
  // Page 2
  const [selectedAddon, setSelectedAddon] = useState<Set<CourseId>>(new Set());
  // Page 3
  const [counselingAnswer, setCounselingAnswer] = useState<"Y" | "N" | "">("");
  // Page 4 — 개별 해제 (추천에서 빠지진 않고 회색 처리)
  const [disabledCourses, setDisabledCourses] = useState<Set<CourseId>>(
    new Set(),
  );

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
    if (val === "N") pruneDisabled("counseling");
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
    if (counselingAnswer === "Y") s.add("counseling");
    return s;
  }, [selectedMain, selectedAddon, counselingAnswer]);

  // 추천 결과 계산
  const recommendation = useMemo(() => {
    const courses = Array.from(currentCourseIds).map((id) => COURSES[id]);
    const activeCourses = courses.filter((c) => !disabledCourses.has(c.id));
    // 강의당 "수료증 + 서약서" 1세트 생성. 심리상담 의견서만 별도 표기.
    const docs = courses.map((c) => ({
      name: c.id === "counseling" ? c.name : `${c.name} 수료증 + 서약서`,
      active: !disabledCourses.has(c.id),
    }));
    const total = activeCourses.reduce((sum, c) => sum + c.price, 0);
    return {
      courses,
      documents: docs,
      total,
      activeCourseCount: activeCourses.length,
    };
  }, [currentCourseIds, disabledCourses]);

  function handleCheckout() {
    if (recommendation.activeCourseCount === 0) return;
    if (!tokenStorage.getAccess()) {
      router.push(`/login?next=${encodeURIComponent("/mypage")}`);
      return;
    }
    router.push("/mypage");
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
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            사건 유형을 선택하시면 필요한 강의와 발급 가능한 서류를 안내해 드립니다.
          </p>
        </div>
        {/* 데스크톱 풀 헤더 */}
        <div className="hidden md:block pt-10">
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
              />
            ) : null}
            {step === 4 ? (
              <Step4Result
                recommendation={recommendation}
                disabledCourses={disabledCourses}
                onToggleCourse={toggleCourse}
                selectedMain={selectedMain}
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
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
              <FileText className="h-3 w-3 text-[#1C3461]" />
              발급 가능 서류
              {recommendation.documents.length > 0 ? (
                <span className="font-mono text-slate-500">
                  (
                  {recommendation.documents.filter((d) => d.active).length +
                    (recommendation.courses.some(
                      (c) => c.id === "counseling" && !disabledCourses.has("counseling"),
                    )
                      ? COUNSELING_BONUS_ITEMS.length
                      : 0)}
                  개)
                </span>
              ) : null}
            </div>
            {recommendation.documents.length === 0 ? (
              <p className="text-[11px] text-slate-400">
                사건 유형을 선택하시면 발급 가능한 서류가 표시됩니다.
              </p>
            ) : (
              <ul className="flex max-h-20 flex-col gap-1 overflow-y-auto pr-1">
                {recommendation.documents.map((d) => (
                  <li
                    key={d.name}
                    className={`flex items-start gap-1.5 text-[11px] leading-snug ${
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
                  <p className="text-[10px] font-bold text-slate-500">합계</p>
                  <p className="text-base font-extrabold text-[#1C3461]">
                    {recommendation.total.toLocaleString()}원
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={recommendation.activeCourseCount === 0}
                  className="rounded-full bg-[#1C3461] px-4 py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-40"
                >
                  수강 신청 →
                </button>
              </div>
            )}
          </div>
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
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
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
      <p className="mt-1 text-xs text-slate-500">
        해당되는 항목을 모두 선택해 주세요. (복수 선택 가능) ·{" "}
        <span className="font-semibold text-[#1C3461]">준법의식 강화</span>는
        모든 경우에 기본으로 포함됩니다.
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
                  className={`font-sans text-[14px] font-bold ${
                    active ? "text-[#1C3461]" : "text-slate-900"
                  }`}
                >
                  {course.name}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 truncate">
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
              className={`font-sans text-[14px] font-bold ${
                etcSelected ? "text-[#1C3461]" : "text-slate-900"
              }`}
            >
              기타
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 truncate">
              위 항목에 해당하지 않는 사건
            </p>
          </div>
        </button>
      </div>

      {selectedMain.size === 0 && !etcSelected ? (
        <p className="mt-4 text-xs text-slate-400">
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
      <p className="mt-1 text-xs text-slate-500">
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
                    className={`font-sans text-[14px] font-bold ${
                      active ? "text-[#1C3461]" : "text-slate-900"
                    }`}
                  >
                    {course.name}
                  </p>
                  {recommended ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      <Sparkles className="h-2.5 w-2.5" /> 추천
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500 truncate">
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

function Step3Counseling({
  answer,
  onAnswer,
}: {
  answer: "Y" | "N" | "";
  onAnswer: (val: "Y" | "N") => void;
}) {
  const [explainerOpen, setExplainerOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm md:p-7">
      <h2 className="font-sans text-lg font-extrabold text-slate-900 sm:text-xl">
        마지막으로 한 가지만 확인할게요
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        전문가 심리상담 의견서는 사건 유형과 무관하게 신청하실 수 있습니다.
      </p>

      <div className="mt-5 rounded-xl border border-zinc-100 bg-slate-50/40 p-3.5">
        <p className="text-xs sm:text-sm font-bold text-slate-800">
          {COUNSELING_QUESTION}
        </p>
        <div className="mt-2.5 flex gap-2">
          {(["Y", "N"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onAnswer(opt)}
              className={`min-w-[70px] rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                answer === opt
                  ? "bg-[#1C3461] text-white shadow-sm"
                  : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              {opt === "Y" ? "예" : "아니오"}
            </button>
          ))}
        </div>
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
              <ul className="mt-2 space-y-1.5 text-[13px]">
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
  total: number;
  activeCourseCount: number;
};

function Step4Result({
  recommendation,
  disabledCourses,
  onToggleCourse,
  selectedMain,
}: {
  recommendation: Recommendation;
  disabledCourses: Set<CourseId>;
  onToggleCourse: (id: CourseId) => void;
  selectedMain: Set<CourseId>;
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
          <p className="mt-3 text-xs font-medium text-amber-600">
            추천 강의를 해제하면 해당 수료증이 발급되지 않습니다.
          </p>
        ) : null}
        <p className="mt-4 text-xs text-slate-500">
          * 수료증은 결제 후 강의를 수료(진도+퀴즈 통과)하면 발급됩니다.
        </p>
      </div>

      <PrepChecklist selectedMain={selectedMain} />
    </section>
  );
}

// ---------- 우측 카트 카드 ----------------------------------------------------

function CartSummary({
  recommendation,
  disabledCourses,
  step,
  onCheckout,
}: {
  recommendation: Recommendation;
  disabledCourses: Set<CourseId>;
  step: Step;
  onCheckout: () => void;
}) {
  const noneSelected = recommendation.activeCourseCount === 0;
  const counselingActive = recommendation.courses.some(
    (c) => c.id === "counseling" && !disabledCourses.has("counseling"),
  );
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="font-sans text-sm font-extrabold tracking-wide text-slate-900">
        추천 강의
      </h3>
      <p className="mt-0.5 text-[11px] text-slate-500">
        선택하신 사건에 따른 추천 강의입니다.
      </p>

      <ul className="mt-4 space-y-2">
        {recommendation.courses.length === 0 ? (
          <li className="text-xs text-slate-400">아직 선택된 과정이 없습니다.</li>
        ) : (
          recommendation.courses.map((c) => {
            const active = !disabledCourses.has(c.id);
            return (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span
                  className={`truncate pr-2 ${
                    active ? "text-slate-700" : "text-slate-400 line-through"
                  }`}
                >
                  {c.name}
                </span>
                {step === 4 ? (
                  <span
                    className={`shrink-0 font-mono text-xs font-bold ${
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

      {/* 발급 가능 서류 — 가격보다 위에 배치 */}
      <div className="my-4 border-t border-zinc-100 pt-4">
        <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <FileText className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          발급 가능 서류
          {recommendation.documents.length > 0 ? (
            <span className="font-mono font-medium text-slate-500">
              (
              {recommendation.documents.filter((d) => d.active).length +
                (counselingActive ? COUNSELING_BONUS_ITEMS.length : 0)}
              개)
            </span>
          ) : null}
        </p>
        {recommendation.documents.length === 0 ? (
          <p className="mt-2 text-[11px] text-slate-400">
            강의를 선택하면 발급 서류가 표시됩니다.
          </p>
        ) : (
          <ul className="mt-2.5 space-y-1.5">
            {recommendation.documents.map((d) => (
              <li
                key={d.name}
                className={`flex items-start gap-1.5 text-[12px] leading-snug ${
                  d.active ? "text-slate-700" : "text-slate-400 line-through"
                }`}
              >
                <Check
                  className={`mt-0.5 h-3 w-3 shrink-0 ${
                    d.active ? "text-[#1C3461]" : "text-slate-300"
                  }`}
                />
                {d.name}
              </li>
            ))}
          </ul>
        )}

        {/* 심리상담 의견서 포함 시 추가 서류 안내 — 결제 전이라 카드/다운로드
            링크 없이, 발급 가능 서류 목록에 포함될 항목만 안내 */}
        {counselingActive ? (
          <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm">
            <p className="font-medium text-blue-800">
              ✓ 심리상담 의견서 구매 시 함께 제공
            </p>
            <ul className="mt-2 space-y-1 text-blue-700">
              {COUNSELING_BONUS_ITEMS.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="border-t border-zinc-100 pt-4">
        {step === 4 ? (
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">합계</span>
            <span className="font-sans text-lg font-extrabold text-[#1C3461]">
              {recommendation.total.toLocaleString()}원
            </span>
          </div>
        ) : (
          <p className="text-center text-[11px] text-slate-400">
            마지막 단계(추천 결과)에서 금액을 확인하실 수 있습니다.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onCheckout}
        disabled={step !== 4 || noneSelected}
        className="mt-5 w-full rounded-xl bg-[#1C3461] py-3 text-sm font-bold text-white shadow-md shadow-[#1C3461]/20 transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] disabled:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0"
      >
        지금 바로 수강 신청하기
      </button>
      {step === 4 && noneSelected ? (
        <p className="mt-2 text-center text-[11px] font-medium text-amber-600">
          최소 1개 이상의 강의를 선택해 주세요.
        </p>
      ) : null}
      <Link
        href="/courses"
        className="mt-2 block w-full rounded-xl border border-zinc-200 bg-white py-2.5 text-center text-xs font-bold text-slate-700 hover:bg-slate-50"
      >
        강의 전체보기에서 직접 선택
      </Link>
    </div>
  );
}
