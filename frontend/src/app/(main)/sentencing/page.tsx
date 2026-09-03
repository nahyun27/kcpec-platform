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
  Download,
  FileText,
  Scale,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { absUrl, tokenStorage } from "@/lib/api";

// ---------- 사건 유형 (Step 1) ------------------------------------------------

type CrimeKey =
  | "sex"
  | "drunk"
  | "violence"
  | "drug"
  | "gambling"
  | "fraud"
  | "stalking"
  | "school"
  | "obstruct"
  | "etc";

type Crime = {
  key: CrimeKey;
  label: string;
  description: string;
};

const CRIMES: Crime[] = [
  { key: "sex", label: "성범죄", description: "성추행, 성폭력, 불법촬영 등" },
  { key: "drunk", label: "음주운전", description: "음주·약물 운전 적발" },
  { key: "violence", label: "폭행 / 상해", description: "단순 폭행, 상해 등" },
  { key: "drug", label: "마약", description: "투약·소지·유통" },
  { key: "gambling", label: "도박", description: "도박·도박개장·사설사이트" },
  { key: "fraud", label: "사기 / 횡령 / 배임", description: "재산범죄 일반" },
  { key: "stalking", label: "스토킹", description: "스토킹·접근금지 위반" },
  { key: "school", label: "학교폭력", description: "교내 폭력·따돌림" },
  { key: "obstruct", label: "공무집행방해", description: "공무원 폭행·협박" },
  { key: "etc", label: "기타", description: "위 항목에 해당하지 않는 사건" },
];

// ---------- 강의 카탈로그 -----------------------------------------------------

type CourseId =
  | "law"           // 준법의식 강화 (모든 경우 기본 포함)
  | "drunk"         // 음주운전 예방
  | "sex"           // 성범죄 예방
  | "digital_sex"   // 디지털 성범죄 예방
  | "drug"          // 마약 예방
  | "gambling"      // 도박 및 도박개장 예방
  | "fraud"         // 사기횡령배임 등 재산범죄 예방
  | "stalking"      // 스토킹범죄 예방
  | "school"        // 학교폭력 예방
  | "counseling"    // 심리상담 의견서 (별도)
  // 신규 강의 8종 (alembic 0018, is_active=false — 영상 미등록)
  | "anger"         // 분노 조절·감정 통제 교육
  | "alcohol"       // 알코올·중독 습관 교정 교육
  | "workplace"     // 비즈니스·직장 내 윤리 교육
  | "economy"       // 경제 관념·사행성 방지 교육
  | "digital_ethics"// 디지털 저작권·정보통신 윤리 교육
  | "privacy"       // 개인정보 보호·사이버 금융 범죄 예방
  | "youth"         // 청소년범죄예방교육
  | "parenting";    // 보호자 양육 윤리·예방 교육

type CourseInfo = {
  id: CourseId;
  name: string;
  price: number;
};

const COURSES: Record<CourseId, CourseInfo> = {
  law: { id: "law", name: "준법의식 강화", price: 22_000 },
  drunk: { id: "drunk", name: "음주운전 예방", price: 55_000 },
  sex: { id: "sex", name: "성범죄 예방", price: 55_000 },
  digital_sex: { id: "digital_sex", name: "디지털 성범죄 예방", price: 55_000 },
  drug: { id: "drug", name: "마약 예방", price: 55_000 },
  gambling: { id: "gambling", name: "도박 및 도박개장 예방", price: 55_000 },
  fraud: { id: "fraud", name: "사기·횡령·배임 예방", price: 55_000 },
  stalking: { id: "stalking", name: "스토킹범죄 예방", price: 55_000 },
  school: { id: "school", name: "학교폭력 예방", price: 55_000 },
  counseling: { id: "counseling", name: "심리상담 의견서", price: 143_000 },
  anger: { id: "anger", name: "분노 조절·감정 통제 교육", price: 55_000 },
  alcohol: { id: "alcohol", name: "알코올·중독 습관 교정 교육", price: 55_000 },
  workplace: { id: "workplace", name: "비즈니스·직장 내 윤리 교육", price: 55_000 },
  economy: { id: "economy", name: "경제 관념·사행성 방지 교육", price: 55_000 },
  digital_ethics: { id: "digital_ethics", name: "디지털 저작권·정보통신 윤리 교육", price: 55_000 },
  privacy: { id: "privacy", name: "개인정보 보호·사이버 금융 범죄 예방", price: 55_000 },
  youth: { id: "youth", name: "청소년범죄예방교육", price: 55_000 },
  parenting: { id: "parenting", name: "보호자 양육 윤리·예방 교육", price: 55_000 },
};

// 죄명 → 추천 강의 매핑
const CRIME_TO_COURSES: Record<CrimeKey, CourseId[]> = {
  sex: ["sex", "digital_sex", "digital_ethics"],
  drunk: ["drunk"],
  violence: ["anger"],
  drug: ["drug"],
  gambling: ["gambling", "economy"],
  fraud: ["fraud", "economy", "privacy"],
  stalking: ["stalking"],
  school: ["school", "youth"],
  obstruct: ["anger"],
  etc: [],
};

// ---------- Y/N 추가 질문 (Step 2) -------------------------------------------

type FollowUp = {
  key: string;
  question: string;
  // 어떤 죄명이 선택됐을 때 노출
  trigger: (selected: Set<CrimeKey>) => boolean;
  // 'Y' 응답 시 추가될 강의 (없으면 없음)
  yesAddCourse?: CourseId;
};

const FOLLOWUPS: FollowUp[] = [
  {
    key: "drunk_habit",
    question: "음주 습관 개선을 위한 추가 교육이 필요하신가요?",
    trigger: (s) => s.has("drunk"),
    yesAddCourse: "alcohol",
  },
  {
    key: "workplace",
    question: "직장 또는 회사 관련 사건인가요?",
    trigger: (s) =>
      s.has("fraud") || s.has("obstruct") || s.has("violence") || s.has("etc"),
    yesAddCourse: "workplace",
  },
  {
    key: "counseling_needed",
    question: "심리상담 의견서가 필요하신가요?",
    // 심리상담 의견서는 사건 유형과 무관하게 모든 경우에 노출.
    trigger: () => true,
    yesAddCourse: "counseling",
  },
];

// ---------- 준비 서류 체크리스트 (양형자료 준비 가이드북 Ⅶ장 기준) -----------

type ChecklistGroup = {
  key: string;
  label: string;
  // 어떤 죄명이 선택됐을 때 노출 (공통은 항상 true)
  trigger: (selected: Set<CrimeKey>) => boolean;
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
    trigger: (s) => s.has("drunk"),
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
      ["violence", "stalking", "school", "fraud", "gambling"].some((k) =>
        s.has(k as CrimeKey),
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

function PrepChecklist({ selected }: { selected: Set<CrimeKey> }) {
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

  const groups = CHECKLIST_GROUPS.filter((g) => g.trigger(selected));
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

      <a
        href={absUrl("/static/resources/sentencing_materials_guidebook.pdf")}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#1C3461]/20 bg-[#1C3461]/5 px-4 py-2 text-xs font-bold text-[#1C3461] hover:bg-[#1C3461]/10"
      >
        <Download className="h-3.5 w-3.5" />
        양형자료 준비 가이드북 PDF 다운로드
      </a>

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

export default function SentencingPage() {
  const router = useRouter();
  const [step, _setStep] = useState<1 | 2 | 3>(1);
  function setStep(next: 1 | 2 | 3 | ((s: 1 | 2 | 3) => 1 | 2 | 3)) {
    _setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const [selected, setSelected] = useState<Set<CrimeKey>>(new Set());
  const [answers, setAnswers] = useState<Record<string, "Y" | "N" | "">>({});
  // Step3 에서 사용자가 개별 해제한 강의 — 추천에서 빠지진 않고 회색 처리.
  const [disabledCourses, setDisabledCourses] = useState<Set<CourseId>>(
    new Set(),
  );

  function toggleCrime(key: CrimeKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function setAnswer(key: string, val: "Y" | "N") {
    setAnswers((prev) => ({ ...prev, [key]: val }));
  }

  function toggleCourse(id: CourseId) {
    setDisabledCourses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 노출되어야 할 follow-up 만 필터
  const activeFollowups = FOLLOWUPS.filter((f) => f.trigger(selected));

  // 추천 결과 계산
  const recommendation = useMemo(() => {
    const courseIds = new Set<CourseId>(["law"]); // 준법의식 항상 포함
    selected.forEach((k) => CRIME_TO_COURSES[k].forEach((c) => courseIds.add(c)));
    activeFollowups.forEach((f) => {
      if (f.yesAddCourse && answers[f.key] === "Y") {
        courseIds.add(f.yesAddCourse);
      }
    });
    const courses = Array.from(courseIds).map((id) => COURSES[id]);
    // 강의당 "수료증 + 서약서" 1세트 생성. 심리상담 의견서만 별도 표기.
    const docs = courses.map((c) => ({
      name:
        c.id === "counseling" ? c.name : `${c.name} 수료증 + 서약서`,
      active: !disabledCourses.has(c.id),
    }));
    const total = courses
      .filter((c) => !disabledCourses.has(c.id))
      .reduce((sum, c) => sum + c.price, 0);
    const activeCourseCount = courses.length - disabledCourses.size;
    return { courses, documents: docs, total, activeCourseCount };
  }, [selected, answers, activeFollowups, disabledCourses]);

  function handleCheckout() {
    if (recommendation.activeCourseCount === 0) return;
    if (!tokenStorage.getAccess()) {
      router.push(`/login?next=${encodeURIComponent("/mypage")}`);
      return;
    }
    // 실제 결제는 강의 수료 후 가능 — 일단 마이페이지로 이동시켜 진행 상황을 확인하게 한다.
    router.push("/mypage");
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-48 lg:pb-24 animate-in fade-in duration-300">
      {/* 모바일: 제목만 간결하게 / 데스크톱: 풀 헤더 */}
      <div className="bg-white relative z-10 border-b border-slate-100">
        {/* 모바일 컴팩트 헤더 */}
        <div className="px-4 py-3 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-sans text-lg font-extrabold text-slate-900">
              양형자료 추천
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
              title="양형자료 추천"
              subtitle="Find your sentencing material"
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
                selected={selected}
                onToggle={toggleCrime}
              />
            ) : null}
            {step === 2 ? (
              <Step2
                followups={activeFollowups}
                answers={answers}
                onAnswer={setAnswer}
              />
            ) : null}
            {step === 3 ? (
              <Step3
                recommendation={recommendation}
                disabledCourses={disabledCourses}
                onToggleCourse={toggleCourse}
                selected={selected}
              />
            ) : null}

            {/* 네비게이션 */}
            {/* 네비 — 데스크톱만 (모바일은 하단 fixed bar) */}
            <div className="hidden items-center justify-between gap-3 pt-2 lg:flex">
              <button
                type="button"
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
                disabled={step === 1}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" /> 이전
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => ((s + 1) as 1 | 2 | 3))}
                  disabled={step === 1 && selected.size === 0}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1C3461] px-6 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] disabled:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0"
                >
                  다음 <ArrowRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {/* 우측 sticky 카트 (Step 3 에서 의미 있음 — 1/2 에서는 미리보기 가이드) */}
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
                  ({recommendation.documents.filter((d) => d.active).length}개)
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
              onClick={() =>
                setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))
              }
              disabled={step === 1}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm disabled:opacity-30"
            >
              <ArrowLeft className="h-4 w-4" /> 이전
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => ((s + 1) as 1 | 2 | 3))}
                disabled={step === 1 && selected.size === 0}
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
  step: 1 | 2 | 3;
  compact?: boolean;
}) {
  const items = [
    { n: 1, label: "사건 유형" },
    { n: 2, label: "추가 질문" },
    { n: 3, label: "추천 결과" },
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

// ---------- Step 1: 사건 유형 선택 -------------------------------------------

function Step1({
  selected,
  onToggle,
}: {
  selected: Set<CrimeKey>;
  onToggle: (key: CrimeKey) => void;
}) {
  return (
    <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm md:p-7">
      <h2 className="font-sans text-lg font-extrabold text-slate-900 sm:text-xl">
        어떤 사건으로 오셨나요?
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        해당되는 항목을 모두 선택해 주세요. (복수 선택 가능)
      </p>

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CRIMES.map((c) => {
          const active = selected.has(c.key);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onToggle(c.key)}
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
                  {c.label}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 truncate">{c.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {selected.size === 0 ? (
        <p className="mt-4 text-xs text-slate-400">
          1개 이상 선택하시면 다음 단계로 진행할 수 있습니다.
        </p>
      ) : null}
    </section>
  );
}

// ---------- Step 2: 추가 Y/N 질문 --------------------------------------------

// 심리상담 의견서 관련 follow-up 키 — 해당 항목 아래에 설명 토글 노출.
const COUNSELING_FOLLOWUP_KEYS = new Set(["counseling_needed"]);

function Step2({
  followups,
  answers,
  onAnswer,
}: {
  followups: FollowUp[];
  answers: Record<string, "Y" | "N" | "">;
  onAnswer: (key: string, val: "Y" | "N") => void;
}) {
  const [explainerOpen, setExplainerOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm md:p-7">
      <h2 className="font-sans text-lg font-extrabold text-slate-900 sm:text-xl">
        몇 가지만 더 확인할게요
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        선택하신 사건 유형에 따라 추가로 필요한 정보를 확인합니다.
      </p>

      {followups.length === 0 ? (
        <p className="mt-5 rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          선택하신 사건 유형에 대한 추가 질문은 없습니다. 다음 단계로 진행해 주세요.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {followups.map((f) => {
            const val = answers[f.key] ?? "";
            const isCounseling = COUNSELING_FOLLOWUP_KEYS.has(f.key);
            return (
              <li key={f.key} className="rounded-xl border border-zinc-100 bg-slate-50/40 p-3.5">
                <p className="text-xs sm:text-sm font-bold text-slate-800">{f.question}</p>
                <div className="mt-2.5 flex gap-2">
                  {(["Y", "N"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onAnswer(f.key, opt)}
                      className={`min-w-[70px] rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                        val === opt
                          ? "bg-[#1C3461] text-white shadow-sm"
                          : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      {opt === "Y" ? "예" : "아니오"}
                    </button>
                  ))}
                </div>
                {isCounseling ? (
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
                          <li>
                            • 작성 후 전문가 검토를 거쳐 발급 (AI 초안 + 전문가 검수)
                          </li>
                          <li>• 발급까지 1~2 영업일 소요</li>
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------- Step 3: 추천 결과 ------------------------------------------------

type Recommendation = {
  courses: CourseInfo[];
  documents: { name: string; active: boolean }[];
  total: number;
  activeCourseCount: number;
};

function Step3({
  recommendation,
  disabledCourses,
  onToggleCourse,
  selected,
}: {
  recommendation: Recommendation;
  disabledCourses: Set<CourseId>;
  onToggleCourse: (id: CourseId) => void;
  selected: Set<CrimeKey>;
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

      <PrepChecklist selected={selected} />
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
  step: 1 | 2 | 3;
  onCheckout: () => void;
}) {
  const noneSelected = recommendation.activeCourseCount === 0;
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="font-sans text-sm font-extrabold tracking-wide text-slate-900">
        선택하신 과정
      </h3>
      <p className="mt-0.5 text-[11px] text-slate-500">
        선택에 따라 실시간 갱신
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
                <span
                  className={`shrink-0 font-mono text-xs font-bold ${
                    active ? "text-slate-700" : "text-slate-400 line-through"
                  }`}
                >
                  {c.price.toLocaleString()}원
                </span>
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

        {/* 심리상담 의견서 포함 시 추가 서류 안내 */}
        {recommendation.courses.some(
          (c) => c.id === "counseling" && !disabledCourses.has("counseling"),
        ) ? (
          <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm">
            <p className="font-medium text-blue-800">
              ✓ 심리상담 의견서 구매 시 함께 제공
            </p>
            <ul className="mt-2 space-y-1 text-blue-700">
              <li>• 자기성찰 리포트</li>
              <li>• 교육이수 소감문</li>
              <li>• CBT 기반 재범방지 자가진단 검사지</li>
              <li>• 맞춤형 양형자료 준비 가이드북</li>
            </ul>
          </div>
        ) : null}
      </div>

      <div className="border-t border-zinc-100 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">합계</span>
          <span className="font-sans text-lg font-extrabold text-[#1C3461]">
            {recommendation.total.toLocaleString()}원
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onCheckout}
        disabled={step !== 3 || noneSelected}
        className="mt-5 w-full rounded-xl bg-[#1C3461] py-3 text-sm font-bold text-white shadow-md shadow-[#1C3461]/20 transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] disabled:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0"
      >
        지금 바로 수강 신청하기
      </button>
      {step === 3 && noneSelected ? (
        <p className="mt-2 text-center text-[11px] font-medium text-amber-600">
          최소 1개 이상의 강의를 선택해 주세요.
        </p>
      ) : null}
      <Link
        href="/courses"
        className="mt-2 block w-full rounded-xl border border-zinc-200 bg-white py-2.5 text-center text-xs font-bold text-slate-700 hover:bg-slate-50"
      >
        강의 목록에서 직접 선택
      </Link>
    </div>
  );
}
