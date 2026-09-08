"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import {
  getMySurvey,
  submitSurvey,
  tokenStorage,
  updateMySurvey,
} from "@/lib/api";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDialog } from "@/components/ui/DialogProvider";

// ---------- 인적사항 (구조화 입력) -------------------------------------------

type Gender = "" | "남" | "여";
type CriminalRecord = "" | "없음" | "있음";

type PersonalInfo = {
  name: string;
  gender: Gender;
  birthdate: string;     // ISO yyyy-mm-dd
  phone: string;
  age: string;           // string for input flexibility
  job: string;
  education: string;
  family: string;
  criminal_record: CriminalRecord;
  criminal_detail: string;
  health: string;
  military: string;
};

const EMPTY_PERSONAL: PersonalInfo = {
  name: "",
  gender: "",
  birthdate: "",
  phone: "",
  age: "",
  job: "",
  education: "",
  family: "",
  criminal_record: "",
  criminal_detail: "",
  health: "",
  military: "",
};

const EDUCATION_OPTIONS = [
  "중졸 이하",
  "고졸",
  "대학 재학",
  "대졸",
  "대학원졸",
];

const MILITARY_OPTIONS = [
  "해당없음",
  "복무중",
  "만기전역",
  "미필",
  "면제",
];

function calcAge(isoDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [y, m, d] = isoDate.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? age : null;
}

// ---------- 자유 응답 (q2..q6) -----------------------------------------------

type Question = {
  /** 백엔드 responses 키 (예: "q2") */
  key: string;
  /** 구버전 한글 키 (편집 모드 prefill 폴백) */
  legacyKey: string;
  label: string;
  description: string;
  placeholder: string;
  required: boolean;
};

const QUESTIONS: Question[] = [
  {
    key: "q2",
    legacyKey: "사건내용",
    label: "이 사건의 내용",
    description:
      "각 사건별로 일시, 장소, 구체적인 경위를 시간 순서대로 작성해 주세요.",
    placeholder:
      "예) 2025년 8월 어느 토요일 밤, 서울 강남구. 회식 후 음주 상태에서...",
    required: true,
  },
  {
    key: "q3",
    legacyKey: "후회되는점",
    label: "이 사건에서 가장 후회되는 점",
    description:
      "사건 당시 본인의 판단·행동 중 지금 돌이켜 가장 후회되는 부분을 솔직하게 적어 주세요.",
    placeholder:
      "예) 술자리를 거절하지 못하고 결국 직접 차에 탔던 점이 가장 후회됩니다.",
    required: true,
  },
  {
    key: "q4",
    legacyKey: "걱정되는점",
    label: "이 사건으로 인해 가장 걱정되는 점",
    description:
      "법적·경제적·관계적·심리적 측면에서 지금 가장 우려되는 부분을 적어 주세요.",
    placeholder:
      "예) 가족이 받게 될 정신적 부담, 직장 내 평판과 향후 경력에 미칠 영향이...",
    required: true,
  },
  {
    key: "q5",
    legacyKey: "재범방지노력",
    label: "추후 재범하지 않기 위해 스스로 노력해야 하는 점",
    description:
      "구체적인 행동 계획이나 환경 변화 등 본인이 실천할 수 있는 다짐을 적어 주세요.",
    placeholder:
      "예) 회식 자리는 1차에서 정리, 음주 시 무조건 대중교통 이용, 매주 ...",
    required: true,
  },
  {
    key: "q6",
    legacyKey: "하고싶은말",
    label: "더 하고 싶은 말 (선택사항)",
    description:
      "위 항목 외에 상담사에게 미리 전달하고 싶은 내용이 있다면 자유롭게 적어 주세요.",
    placeholder:
      "예) 현재 정신과 약물 복용 중이며, 사건 이후 불면 증상이 있습니다.",
    required: false,
  },
];

// ---------- 컴포넌트 ----------------------------------------------------------

export default function SurveyClient() {
  const router = useRouter();
  const dialog = useDialog();
  const searchParams = useSearchParams();
  const editParam = searchParams.get("edit");
  const editSurveyId = editParam ? Number(editParam) : null;
  const isEditMode = editSurveyId != null && Number.isFinite(editSurveyId);

  const orderIdParam =
    searchParams.get("order_id") ?? searchParams.get("counseling_order_id");
  const orderId = orderIdParam ? Number(orderIdParam) : NaN;
  const isCounseling = searchParams.get("counseling_order_id") != null;

  const [personal, setPersonal] = useState<PersonalInfo>(EMPTY_PERSONAL);
  const [answers, setAnswers] = useState<string[]>(() => QUESTIONS.map(() => ""));
  const [loadingPrefill, setLoadingPrefill] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 이탈 가드(hasProgress)가 "빈 값인지"가 아니라 "원래 불러온 값에서 실제로
  // 바뀌었는지"를 봐야 한다 — 수정 모드는 prefill 직후부터 필드가 전부
  // 채워져 있어 단순 "비어있지 않음" 기준으로는 아무것도 안 고쳐도 항상
  // hasProgress=true 가 되어, 방금 만든 "수정 취소" 버튼조차 누르자마자
  // "내용이 사라집니다" 경고가 뜨는 문제가 있었다.
  const [baseline, setBaseline] = useState<{ personal: PersonalInfo; answers: string[] }>({
    personal: EMPTY_PERSONAL,
    answers: QUESTIONS.map(() => ""),
  });

  // 비로그인 → 로그인 페이지로
  useEffect(() => {
    if (tokenStorage.getAccess()) return;
    let next = "/survey";
    if (isEditMode) next = `/survey?edit=${editSurveyId}`;
    else if (isCounseling) next = `/survey?counseling_order_id=${orderId}`;
    else if (Number.isFinite(orderId)) next = `/survey?order_id=${orderId}`;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 신규 모드 진입 가드
  useEffect(() => {
    if (isEditMode) return;
    if (!Number.isFinite(orderId)) {
      setError("잘못된 접근입니다. (order_id 누락)");
    }
  }, [isEditMode, orderId]);

  // 수정 모드 prefill
  useEffect(() => {
    if (!isEditMode || !tokenStorage.getAccess()) return;
    let cancelled = false;
    getMySurvey(editSurveyId!)
      .then((d) => {
        if (cancelled) return;
        const r = d.responses ?? {};
        const p = r.personal;
        const loadedPersonal =
          p && typeof p === "object"
            ? { ...EMPTY_PERSONAL, ...(p as Partial<PersonalInfo>) }
            : EMPTY_PERSONAL;
        setPersonal(loadedPersonal);
        // 자유 응답: q2..q6 우선, 없으면 한글 legacy 키 폴백
        const next = QUESTIONS.map(
          (q) => (r[q.key] as string | undefined) ?? (r[q.legacyKey] as string | undefined) ?? "",
        );
        setAnswers(next);
        setBaseline({ personal: loadedPersonal, answers: next });
      })
      .catch(() => {
        if (!cancelled) setError("기존 설문을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoadingPrefill(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEditMode, editSurveyId]);

  // 생년월일 → 나이 자동 채움 (사용자가 수동 입력 안 했을 때만)
  useEffect(() => {
    if (!personal.birthdate) return;
    const auto = calcAge(personal.birthdate);
    if (auto == null) return;
    setPersonal((prev) =>
      prev.age && prev.age !== String(auto)
        ? prev // 사용자가 직접 입력한 값이 있으면 덮어쓰지 않음
        : { ...prev, age: String(auto) },
    );
  }, [personal.birthdate]);

  // 작성 중 이탈 시 확인 — 새로고침/탭 닫기(beforeunload) + 내부 링크 클릭
  // (capture 단계에서 Next.js Link 라우팅보다 먼저 가로챔) 모두 가드.
  const hasProgress =
    !submitted &&
    (JSON.stringify(personal) !== JSON.stringify(baseline.personal) ||
      JSON.stringify(answers) !== JSON.stringify(baseline.answers));

  useEffect(() => {
    if (!hasProgress) return;

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);

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
      e.preventDefault();
      e.stopPropagation();
      const destination = `${anchor.pathname}${anchor.search}${anchor.hash}`;
      dialog
        .confirm("지금 나가시면 작성 중인 설문 내용이 모두 사라집니다. 이동하시겠습니까?")
        .then((confirmed) => {
          if (confirmed) router.push(destination);
        });
    }
    document.addEventListener("click", handleClickCapture, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClickCapture, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProgress]);

  function updatePersonal<K extends keyof PersonalInfo>(
    key: K,
    value: PersonalInfo[K],
  ) {
    setPersonal((prev) => ({ ...prev, [key]: value }));
  }

  function updateAnswer(idx: number, value: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }

  // ---------- 검증 ----------
  const personalMissing = useMemo(() => {
    const missing: string[] = [];
    if (!personal.name.trim()) missing.push("성명");
    if (!personal.gender) missing.push("성별");
    if (!personal.birthdate) missing.push("생년월일");
    return missing;
  }, [personal]);

  const freeMissing = QUESTIONS.filter(
    (q, i) => q.required && !answers[i].trim(),
  ).length;

  const isMissing = personalMissing.length > 0 || freeMissing > 0;

  async function handleSubmit() {
    if (isMissing) {
      setError(
        personalMissing.length > 0
          ? `인적사항 필수 항목이 누락됐습니다: ${personalMissing.join(", ")}`
          : "필수 문항(선택사항 제외)에 모두 답변해 주세요.",
      );
      return;
    }
    const confirmed = await dialog.confirm(
      "작성하신 내용으로 설문을 제출하시겠습니까?\n의견서가 발급되기 전까지는 마이페이지에서 다시 수정하실 수 있습니다.",
      { title: "설문 제출", confirmText: "제출하기" },
    );
    if (!confirmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const personalPayload: Record<string, unknown> = {
        ...personal,
        age: personal.age ? Number(personal.age) : null,
      };
      // criminal_detail 은 record="있음" 이 아니면 빈 문자열로 정규화
      if (personal.criminal_record !== "있음") {
        personalPayload.criminal_detail = "";
      }
      const responses: Record<string, unknown> = { personal: personalPayload };
      QUESTIONS.forEach((q, i) => {
        const v = answers[i].trim();
        if (q.required || v.length > 0) responses[q.key] = v;
      });
      if (isEditMode) {
        await updateMySurvey(editSurveyId!, responses);
      } else {
        await submitSurvey(orderId, responses);
      }
      setSubmitted(true);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(
        detail ??
          (isEditMode ? "설문 수정에 실패했습니다." : "설문 제출에 실패했습니다."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !submitted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Link
          href="/mypage"
          className="mt-6 inline-block rounded bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
        >
          마이페이지로
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-8 text-center shadow-sm">
          <p className="font-sans text-2xl font-bold text-[var(--color-primary)]">
            {isEditMode ? "설문이 수정되었습니다" : "설문이 제출되었습니다"}
          </p>
          <p className="mt-3 text-sm text-zinc-700">
            {isEditMode
              ? "수정된 응답으로 검토가 다시 진행됩니다. 결과는 24시간 이내에 이메일로 전달드립니다."
              : "전문 상담사가 검토 후 24시간 이내에 이메일로 의견서를 전달드립니다."}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            진행 상황은 마이페이지에서 확인하실 수 있습니다.
          </p>
          <div className="mt-8 flex flex-col gap-2">
            <Link
              href="/mypage"
              className="rounded bg-[var(--color-primary)] py-3 font-semibold text-white hover:bg-[var(--color-primary-hover)]"
            >
              마이페이지로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loadingPrefill) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center text-sm text-zinc-500">
        기존 응답을 불러오는 중입니다...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-16">
      <PageHeader
        title={isEditMode ? "심리상담 설문 수정" : "심리상담 설문"}
        subtitle={isEditMode ? "Edit Survey" : "Counseling Survey"}
        icon={<FileText className="h-3.5 w-3.5" />}
        description={
          isEditMode
            ? "수정 후 제출하시면 검토가 다시 진행됩니다."
            : "전문 심리상담사가 분석할 수 있도록 가능한 한 구체적이고 솔직하게 답변해 주세요."
        }
        centered
      />

      <div className="space-y-10">
        {/* 인적사항 (구조화 입력) */}
        <PersonalSection personal={personal} onChange={updatePersonal} />

        {/* 자유 응답 q2..q6 */}
        {QUESTIONS.map((q, idx) => (
          <FreeAnswerSection
            key={q.key}
            index={idx + 2}   // 표시 번호: 2~6 (인적사항이 1번)
            question={q}
            value={answers[idx]}
            onChange={(v) => updateAnswer(idx, v)}
          />
        ))}
      </div>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3 pt-2">
        {isEditMode ? (
          <Link
            href="/mypage?tab=counseling"
            className="flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 py-4 text-base font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            수정 취소
          </Link>
        ) : null}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || isMissing}
          className="flex-1 rounded-xl bg-[var(--color-primary)] py-4 text-base font-semibold text-white shadow-md shadow-[var(--color-primary)]/20 transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] hover:shadow-lg hover:shadow-[var(--color-primary)]/30 disabled:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {submitting
            ? isEditMode
              ? "수정 중..."
              : "제출 중..."
            : isMissing
              ? personalMissing.length > 0
                ? `필수 인적사항: ${personalMissing.join(", ")}`
                : `필수 ${freeMissing}문항 남음`
              : isEditMode
                ? "수정 완료"
                : "제출하기"}
        </button>
      </div>
    </div>
  );
}

// ---------- subcomponents ----------------------------------------------------

function SectionShell({
  index,
  label,
  description,
  children,
}: {
  index: number;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary)]/10 font-mono text-xs font-bold tracking-wider text-[var(--color-primary)]">
          {String(index).padStart(2, "0")}
        </span>
        <h2 className="font-sans text-base font-semibold leading-snug text-zinc-900">
          {label}
        </h2>
      </div>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const inputCls =
  "w-full rounded border border-[var(--color-border)] px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20";

function FieldLabel({
  required,
  children,
}: {
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-bold text-slate-700">
      {children}
      {required ? <span className="ml-1 text-red-500">*</span> : null}
    </label>
  );
}

function PersonalSection({
  personal,
  onChange,
}: {
  personal: PersonalInfo;
  onChange: <K extends keyof PersonalInfo>(key: K, value: PersonalInfo[K]) => void;
}) {
  return (
    <SectionShell
      index={1}
      label="인적사항"
      description="의견서 기본 정보로 사용되는 항목입니다. 정확히 입력해 주세요."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel required>성명</FieldLabel>
          <input
            value={personal.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="홍길동"
            className={inputCls}
            maxLength={50}
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel required>성별</FieldLabel>
          <div className="flex h-[42px] items-center gap-4 px-1 text-sm">
            {(["남", "여"] as const).map((g) => (
              <label key={g} className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="gender"
                  value={g}
                  checked={personal.gender === g}
                  onChange={() => onChange("gender", g)}
                  className="accent-[var(--color-primary)]"
                />
                {g}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <FieldLabel required>생년월일</FieldLabel>
          <input
            type="date"
            value={personal.birthdate}
            onChange={(e) => onChange("birthdate", e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel>나이</FieldLabel>
          <input
            type="number"
            min={0}
            max={130}
            value={personal.age}
            onChange={(e) => onChange("age", e.target.value)}
            placeholder="생년월일 입력 시 자동 계산"
            className={inputCls}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <FieldLabel>연락처</FieldLabel>
          <input
            type="tel"
            value={personal.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            placeholder="010-0000-0000"
            className={inputCls}
            maxLength={20}
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel>직업</FieldLabel>
          <input
            value={personal.job}
            onChange={(e) => onChange("job", e.target.value)}
            placeholder="회사원, 자영업, 학생 등"
            className={inputCls}
            maxLength={50}
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel>학력</FieldLabel>
          <select
            value={personal.education}
            onChange={(e) => onChange("education", e.target.value)}
            className={inputCls}
          >
            <option value="">선택</option>
            {EDUCATION_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <FieldLabel>가족관계</FieldLabel>
          <input
            value={personal.family}
            onChange={(e) => onChange("family", e.target.value)}
            placeholder="예) 기혼, 배우자 및 자녀 1명"
            className={inputCls}
            maxLength={120}
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel>전과 유무</FieldLabel>
          <div className="flex h-[42px] items-center gap-4 px-1 text-sm">
            {(["없음", "있음"] as const).map((c) => (
              <label key={c} className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="criminal_record"
                  value={c}
                  checked={personal.criminal_record === c}
                  onChange={() => onChange("criminal_record", c)}
                  className="accent-[var(--color-primary)]"
                />
                {c}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <FieldLabel>병역</FieldLabel>
          <select
            value={personal.military}
            onChange={(e) => onChange("military", e.target.value)}
            className={inputCls}
          >
            <option value="">선택</option>
            {MILITARY_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        {personal.criminal_record === "있음" ? (
          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel>전과 내용</FieldLabel>
            <textarea
              value={personal.criminal_detail}
              onChange={(e) => onChange("criminal_detail", e.target.value)}
              placeholder="죄명·시기·처분 내역을 간단히 적어 주세요."
              rows={2}
              className={`${inputCls} resize-y`}
              maxLength={500}
            />
          </div>
        ) : null}

        <div className="space-y-1.5 sm:col-span-2">
          <FieldLabel>건강상태</FieldLabel>
          <input
            value={personal.health}
            onChange={(e) => onChange("health", e.target.value)}
            placeholder="특이사항 없으면 '이상 없음'"
            className={inputCls}
            maxLength={100}
          />
        </div>
      </div>
    </SectionShell>
  );
}

function FreeAnswerSection({
  index,
  question,
  value,
  onChange,
}: {
  index: number;
  question: Question;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <SectionShell
      index={index}
      label={
        question.required
          ? `${question.label}`
          : `${question.label}`
      }
      description={question.description}
    >
      {question.required ? null : null}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        maxLength={2000}
        placeholder={question.placeholder}
        className="min-h-[120px] w-full resize-y rounded border border-[var(--color-border)] px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-zinc-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
      />
      <p className="mt-1 text-right text-xs text-zinc-400">
        {value.length} / 2000
      </p>
    </SectionShell>
  );
}
