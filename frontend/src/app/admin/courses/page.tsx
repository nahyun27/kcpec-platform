"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type DragEvent as ReactDragEvent,
} from "react";
import { BookOpen, FileSignature, GripVertical, HeartHandshake, Package, Phone, ScrollText } from "lucide-react";
import { isAxiosError } from "axios";
import {
  addLecture,
  createCourse,
  deleteAdminLecture,
  getAdminCourseLectures,
  getAdminCourseQuiz,
  getAdminCourses,
  getAdminStreamUrl,
  getCounselingCourses,
  getCourseDetail,
  patchAdminLecture,
  patchCourse,
  setQuiz,
} from "@/lib/api";
import {
  COURSE_CATEGORIES,
  type CourseCategory,
  type CourseListItem,
} from "@/types/course";
import type {
  AdminLectureFull,
  AdminQuizQuestion,
  AdminQuizRead,
} from "@/types/admin";
import { useDialog } from "@/components/ui/DialogProvider";

// 상품 관리 탭(2026-11). 반성문·탄원서·구속수용자 발송비는 결제용으로 courses 테이블에
// 들어 있는 (비활성) 상품이라 강의 목록에 섞여 보였다 — 탭으로 따로 뺀다.
type ProductTab = "all" | "courses" | "counseling" | "letters" | "detention";
const PRODUCT_TABS: { key: ProductTab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "courses", label: "온라인 강의" },
  { key: "counseling", label: "심리상담" },
  { key: "letters", label: "반성문·탄원서" },
  { key: "detention", label: "구속수용자" },
];
// backend orders.py 의 *_COURSE_TITLE 과 같은 문자열.
const LETTER_TITLES = ["반성문 작성", "탄원서 작성"];
const DETENTION_FEE_TITLE = "구속수용자 교육자료·발송비";
const NON_LECTURE_TITLES = new Set([...LETTER_TITLES, DETENTION_FEE_TITLE]);

type Modal =
  | { kind: "new-course" }
  | { kind: "edit-course"; course: CourseListItem }
  | { kind: "new-lecture"; course: CourseListItem }
  | { kind: "edit-lecture"; course: CourseListItem; lecture: AdminLectureFull }
  | { kind: "quiz"; course: CourseListItem }
  | null;

export default function AdminCoursesPage() {
  const dialog = useDialog();
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [lecturesByCourse, setLecturesByCourse] = useState<
    Record<number, AdminLectureFull[]>
  >({});
  const [quizByCourse, setQuizByCourse] = useState<Record<number, AdminQuizRead>>({});
  const [tab, setTab] = useState<ProductTab>("all");
  const show = (k: ProductTab) => tab === "all" || tab === k;
  const lectureCourses = courses.filter((c) => !NON_LECTURE_TITLES.has(c.title));
  const letterCourses = LETTER_TITLES.flatMap((t) => courses.filter((c) => c.title === t));
  const detentionFee = courses.filter((c) => c.title === DETENTION_FEE_TITLE);

  async function load(isInitial = false) {
    if (!isInitial) setError(null);
    try {
      const courseList = await getAdminCourses();
      setCourses(courseList);
      // 접힌 상태에서도 영상 수 + 퀴즈 상태 뱃지를 보여주기 위해 일괄 prefetch.
      // 모든 강의에 대해 lectures + quiz 를 병렬로 받아온다 (대략 N×2 요청).
      void Promise.all(
        courseList.flatMap((c) => [loadLectures(c.id), loadQuiz(c.id)]),
      );
    } catch {
      setError("강의 목록을 불러오지 못했습니다.");
    }
  }

  async function loadLectures(courseId: number) {
    try {
      const list = await getAdminCourseLectures(courseId);
      setLecturesByCourse((prev) => ({ ...prev, [courseId]: list }));
    } catch {
      setLecturesByCourse((prev) => ({ ...prev, [courseId]: [] }));
    }
  }

  async function loadQuiz(courseId: number) {
    try {
      const quiz = await getAdminCourseQuiz(courseId);
      setQuizByCourse((prev) => ({ ...prev, [courseId]: quiz }));
    } catch {
      setQuizByCourse((prev) => ({
        ...prev,
        [courseId]: { exists: false, questions: [] },
      }));
    }
  }

  useEffect(() => {
    void load(true);
  }, []);

  function toggleOpen(courseId: number) {
    if (openId === courseId) {
      setOpenId(null);
      return;
    }
    setOpenId(courseId);
    if (lecturesByCourse[courseId] === undefined) void loadLectures(courseId);
    if (quizByCourse[courseId] === undefined) void loadQuiz(courseId);
  }

  async function afterMutation(courseId?: number) {
    setModal(null);
    await load();
    if (courseId != null) {
      await loadLectures(courseId);
      await loadQuiz(courseId);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">
          상품 관리
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          판매 중인 상품의 가격과 온라인 강의(영상·퀴즈)를 관리합니다.
        </p>
      </header>

      <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1" role="tablist">
        {PRODUCT_TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {show("counseling") ? <CounselingPrices /> : null}

      {show("letters") ? (
        <FixedPriceSection
          icon={<ScrollText className="h-5 w-5 text-[var(--color-primary)]" />}
          title="반성문·탄원서"
          description="심리상담이나 맞춤 강의 찾기에서 함께 신청할 때의 1건 가격입니다."
          items={letterCourses}
          subtitle={() => "작성 대행 · 1건"}
          itemIcon={<FileSignature className="h-5 w-5" />}
          onSaved={() => load()}
        />
      ) : null}

      {show("detention") ? (
        <FixedPriceSection
          icon={<Package className="h-5 w-5 text-[var(--color-primary)]" />}
          title="구속수용자 교육"
          description="신청 1건마다 붙는 교육자료 인쇄·발송비입니다. 교육 과정 가격은 온라인 강의·심리상담 가격을 그대로 따릅니다."
          items={detentionFee}
          subtitle={() => "교육자료 인쇄·발송 · 신청 1건당"}
          itemIcon={<Package className="h-5 w-5" />}
          onSaved={() => load()}
        />
      ) : null}

      {show("courses") ? (
      <>
      <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h2 className="flex items-center gap-2 font-sans text-lg font-bold text-slate-900">
            <BookOpen className="h-5 w-5 text-[var(--color-primary)]" />
            온라인 강의
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            전체 {lectureCourses.length.toLocaleString()}개 · 행을 클릭해 영상 목록 확인
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ kind: "new-course" })}
          className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
        >
          + 새 강의 등록
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-slate-200/60 bg-slate-50/50 text-[12px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-12 px-4 py-3 text-center">#</th>
              <th className="px-4 py-3">제목</th>
              <th className="px-4 py-3">카테고리</th>
              <th className="px-4 py-3 text-right">가격</th>
              <th className="px-4 py-3 text-center">활성</th>
              <th className="px-4 py-3 text-right">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lectureCourses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-500">
                  등록된 강의가 없습니다.
                </td>
              </tr>
            ) : (
              lectureCourses.flatMap((c) => {
                const open = openId === c.id;
                return [
                  <tr
                    key={c.id}
                    onClick={() => toggleOpen(c.id)}
                    className={`cursor-pointer transition-colors ${
                      open ? "bg-slate-50/80" : "hover:bg-slate-50/50"
                    }`}
                  >
                    <td className="px-4 py-3 text-center text-xs text-slate-500">
                      {c.id}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <span
                        className={`mr-2 inline-block transition-transform text-slate-400 ${
                          open ? "rotate-90" : ""
                        }`}
                      >
                        ▶
                      </span>
                      {c.title}
                      <CourseRowBadges
                        lectures={lecturesByCourse[c.id]}
                        quiz={quizByCourse[c.id]}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{c.category}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      {c.original_price != null && c.original_price > (c.price ?? 0) ? (
                        <span className="mr-1.5 text-slate-400 line-through">
                          {c.original_price.toLocaleString()}원
                        </span>
                      ) : null}
                      {c.price != null ? `${c.price.toLocaleString()}원` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.is_active ? (
                        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                          활성
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-inset ring-slate-500/10">
                          비활성
                        </span>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setModal({ kind: "new-lecture", course: c })}
                          className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                          영상 추가
                        </button>
                        <QuizButton
                          quiz={quizByCourse[c.id]}
                          onClick={() => setModal({ kind: "quiz", course: c })}
                        />
                        <button
                          type="button"
                          onClick={() => setModal({ kind: "edit-course", course: c })}
                          className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                          수정
                        </button>
                      </div>
                    </td>
                  </tr>,
                  open ? (
                    <tr key={`${c.id}-lectures`} className="bg-slate-50/30">
                      <td colSpan={6} className="px-4 py-3">
                        <LectureList
                          lectures={lecturesByCourse[c.id]}
                          onEdit={(lec) =>
                            setModal({ kind: "edit-lecture", course: c, lecture: lec })
                          }
                          onDelete={async (lec) => {
                            if (!(await dialog.confirm(`"${lec.title}" 영상을 삭제하시겠습니까?`))) return;
                            try {
                              await deleteAdminLecture(lec.id);
                              await loadLectures(c.id);
                            } catch (err) {
                              await dialog.alert(
                                isAxiosError(err)
                                  ? (err.response?.data as { detail?: string } | undefined)
                                      ?.detail ?? "삭제 실패"
                                  : "삭제 실패",
                              );
                            }
                          }}
                          onReorder={async (orderedIds) => {
                            // 1-indexed order_index 를 모두 PATCH (병렬).
                            const results = await Promise.allSettled(
                              orderedIds.map((id, idx) =>
                                patchAdminLecture(id, { order_index: idx + 1 }),
                              ),
                            );
                            await loadLectures(c.id);
                            const failed = results.filter((r) => r.status === "rejected").length;
                            if (failed > 0) {
                              await dialog.alert(
                                `${failed}개 차시의 순서 변경에 실패했습니다. 목록을 새로고침했으니 순서를 확인 후 다시 시도해 주세요.`,
                              );
                            }
                          }}
                          onDurationDetected={async () => {
                            await loadLectures(c.id);
                          }}
                          onAddClick={() => setModal({ kind: "new-lecture", course: c })}
                        />
                      </td>
                    </tr>
                  ) : null,
                ];
              })
            )}
          </tbody>
        </table>
      </div>
      </>
      ) : null}

      {modal?.kind === "new-course" ? (
        <NewCourseModal
          onClose={() => setModal(null)}
          onCreated={() => void afterMutation()}
        />
      ) : null}
      {modal?.kind === "edit-course" ? (
        <EditCourseModal
          course={modal.course}
          onClose={() => setModal(null)}
          onSaved={() => void afterMutation()}
        />
      ) : null}
      {modal?.kind === "new-lecture" ? (
        <NewLectureModal
          course={modal.course}
          onClose={() => setModal(null)}
          onCreated={() => void afterMutation(modal.course.id)}
        />
      ) : null}
      {modal?.kind === "edit-lecture" ? (
        <EditLectureModal
          lecture={modal.lecture}
          onClose={() => setModal(null)}
          onSaved={() => void afterMutation(modal.course.id)}
        />
      ) : null}
      {modal?.kind === "quiz" ? (
        <QuizModal
          course={modal.course}
          existing={quizByCourse[modal.course.id]}
          onClose={() => setModal(null)}
          onSaved={() => void afterMutation(modal.course.id)}
        />
      ) : null}
    </div>
  );
}

// ---------- 심리상담 상품 가격 ------------------------------------------------
// 심리상담 상품은 강의가 아니라 위 표에서 빠져 있어 가격을 고칠 곳이 없었다(2026-11).
// 결제 금액과 심리상담·맞춤 강의 찾기 화면 표시가 모두 여기 값을 따른다.

// 상품별 한 줄 설명(심리상담 페이지 문구와 같게).
const COUNSELING_META: Record<string, { subtitle: string; icon: "phone" | "doc" }> = {
  "기본 프로그램": { subtitle: "서면상담 · 심리상담 의견서", icon: "doc" },
  "전화 심화상담": { subtitle: "전화 상담 · 회당 15분 × 3회", icon: "phone" },
};

function CounselingPrices() {
  const dialog = useDialog();
  const [items, setItems] = useState<CourseListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setItems(await getCounselingCourses());
    } catch {
      setError("심리상담 상품을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    getCounselingCourses()
      .then(setItems)
      .catch(() => setError("심리상담 상품을 불러오지 못했습니다."));
  }, []);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 font-sans text-lg font-bold text-slate-900">
          <HeartHandshake className="h-5 w-5 text-[var(--color-primary)]" />
          심리상담
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          저장하면 1분 안에 결제 금액과 심리상담 페이지에 반영됩니다. 이미 결제된 주문은 그대로입니다.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {items == null ? (
        <p className="rounded-xl border border-slate-200/60 bg-white px-4 py-8 text-center text-sm text-zinc-500">
          불러오는 중...
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-slate-200/60 bg-white px-4 py-8 text-center text-sm text-zinc-500">
          판매 중인 심리상담 상품이 없습니다.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((c) => (
            <ProductPriceCard
              key={`${c.id}-${c.price}-${c.original_price}`}
              course={c}
              subtitle={COUNSELING_META[c.title]?.subtitle}
              icon={
                COUNSELING_META[c.title]?.icon === "phone" ? (
                  <Phone className="h-5 w-5" />
                ) : (
                  <FileSignature className="h-5 w-5" />
                )
              }
              withOriginal
              onSaved={async (msg) => {
                await load();
                await dialog.alert(msg);
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// "270,000" 처럼 쉼표 넣어 보여주고, 저장할 땐 숫자만.
function toDigits(v: string): string {
  return v.replace(/[^0-9]/g, "");
}
function withCommas(digits: string): string {
  return digits === "" ? "" : Number(digits).toLocaleString();
}

function WonInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className="mt-1 flex items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/15">
        <input
          type="text"
          inputMode="numeric"
          value={withCommas(value)}
          onChange={(e) => onChange(toDigits(e.target.value))}
          placeholder={placeholder}
          className="w-full min-w-0 bg-transparent py-2 text-right text-[15px] font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-300"
        />
        <span className="ml-1.5 shrink-0 text-sm text-slate-400">원</span>
      </span>
    </label>
  );
}

// 판매가만 있는 상품(반성문·탄원서, 구속수용자 발송비) 묶음.
function FixedPriceSection({
  icon,
  title,
  description,
  items,
  subtitle,
  itemIcon,
  onSaved,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  items: CourseListItem[];
  subtitle: (c: CourseListItem) => string;
  itemIcon: React.ReactNode;
  onSaved: () => Promise<void>;
}) {
  const dialog = useDialog();
  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 font-sans text-lg font-bold text-slate-900">
          {icon}
          {title}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-slate-200/60 bg-white px-4 py-8 text-center text-sm text-zinc-500">
          불러오는 중...
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((c) => (
            <ProductPriceCard
              key={`${c.id}-${c.price}`}
              course={c}
              subtitle={subtitle(c)}
              icon={itemIcon}
              onSaved={async (msg) => {
                await onSaved();
                await dialog.alert(msg);
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ProductPriceCard({
  course,
  subtitle,
  icon,
  withOriginal = false,
  onSaved,
}: {
  course: CourseListItem;
  subtitle?: string;
  icon: React.ReactNode;
  // 정가(줄 그은 가격)를 고객 화면에 보여주는 상품만 true.
  withOriginal?: boolean;
  onSaved: (message: string) => Promise<void>;
}) {
  const [price, setPrice] = useState(String(course.price));
  const [originalPrice, setOriginalPrice] = useState(
    course.original_price != null ? String(course.original_price) : "",
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const nextPrice = Number(price);
  const nextOriginal = !withOriginal || originalPrice === "" ? null : Number(originalPrice);
  const changed =
    nextPrice !== course.price ||
    (withOriginal && nextOriginal !== (course.original_price ?? null));
  const discountPct =
    nextOriginal != null && nextOriginal > nextPrice && nextPrice > 0
      ? Math.round((1 - nextPrice / nextOriginal) * 100)
      : null;

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!Number.isInteger(nextPrice) || nextPrice <= 0) {
      setErr("판매가를 입력해 주세요.");
      return;
    }
    if (nextOriginal != null && nextOriginal <= nextPrice) {
      setErr("정가는 판매가보다 커야 합니다. 할인 표시가 필요 없으면 비워 두세요.");
      return;
    }
    setSaving(true);
    try {
      await patchCourse(
        course.id,
        withOriginal ? { price: nextPrice, original_price: nextOriginal } : { price: nextPrice },
      );
      await onSaved(`"${course.title}" 가격을 ${nextPrice.toLocaleString()}원으로 바꿨습니다.`);
    } catch (e2) {
      const detail = isAxiosError(e2) ? e2.response?.data?.detail : null;
      setErr(typeof detail === "string" ? detail : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="flex flex-col rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-sans text-base font-bold text-slate-900">{course.title}</p>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
      </div>

      {/* 고객에게 보이는 모양 미리보기 */}
      <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-slate-400">고객에게 보이는 가격</p>
          {discountPct != null ? (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-500">
              {discountPct}% 할인
            </span>
          ) : null}
        </div>
        {discountPct != null ? (
          <p className="mt-1 text-xs text-slate-400 line-through">
            {nextOriginal!.toLocaleString()}원
          </p>
        ) : null}
        <p className="font-sans text-2xl font-extrabold text-[var(--color-primary)]">
          {nextPrice > 0 ? nextPrice.toLocaleString() : "-"}원
        </p>
      </div>

      <div className={`mt-4 grid gap-3 ${withOriginal ? "grid-cols-2" : "grid-cols-1"}`}>
        <WonInput label="판매가" value={price} onChange={setPrice} />
        {withOriginal ? (
          <WonInput label="정가 (선택)" value={originalPrice} onChange={setOriginalPrice} placeholder="할인 표시 없음" />
        ) : null}
      </div>

      {err ? <p className="mt-3 text-xs text-red-600">{err}</p> : null}

      <button
        type="submit"
        disabled={!changed || saving}
        className="mt-4 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:bg-slate-100 disabled:text-slate-400"
      >
        {saving ? "저장 중..." : changed ? "저장" : "변경 사항 없음"}
      </button>
    </form>
  );
}

// ---------- collapsed-row badges -------------------------------------------

function CourseRowBadges({
  lectures,
  quiz,
}: {
  lectures: AdminLectureFull[] | undefined;
  quiz: AdminQuizRead | undefined;
}) {
  // 둘 다 prefetch 미완료 — 아무것도 안 보여줌 (깜빡임 방지)
  if (lectures === undefined && quiz === undefined) return null;

  return (
    <span className="ml-2 inline-flex items-center gap-1.5 align-middle">
      {lectures !== undefined ? (
        lectures.length > 0 ? (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
            🎬 {lectures.length}개
          </span>
        ) : (
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
            영상 없음
          </span>
        )
      ) : null}
      {quiz?.exists ? (
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
          퀴즈 {quiz.questions.length}문항
        </span>
      ) : null}
    </span>
  );
}

// ---------- quiz button ----------------------------------------------------

function QuizButton({
  quiz,
  onClick,
}: {
  quiz: AdminQuizRead | undefined;
  onClick: () => void;
}) {
  if (quiz === undefined) {
    return (
      <button
        type="button"
        disabled
        className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-400 shadow-sm"
      >
        퀴즈 …
      </button>
    );
  }
  if (!quiz.exists) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
      >
        퀴즈 등록
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-[var(--color-primary-hover)]"
    >
      퀴즈 수정
    </button>
  );
}

// ---------- lecture list (accordion content) -------------------------------

function LectureList({
  lectures,
  onEdit,
  onDelete,
  onReorder,
  onDurationDetected,
  onAddClick,
}: {
  lectures: AdminLectureFull[] | undefined;
  onEdit: (lec: AdminLectureFull) => void;
  onDelete: (lec: AdminLectureFull) => void;
  onReorder: (orderedIds: number[]) => Promise<void>;
  onDurationDetected: () => Promise<void>;
  onAddClick: () => void;
}) {
  // 로컬 미러 — 드래그 동안 즉시 시각 반영. props 가 갱신되면 동기화.
  const [prevLectures, setPrevLectures] = useState(lectures);
  const [items, setItems] = useState<AdminLectureFull[]>(lectures ?? []);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  // duration 자동 감지 시도 완료된 lecture id 캐시 (재시도 방지)
  const probedRef = useRef<Set<number>>(new Set());

  if (lectures !== prevLectures) {
    setPrevLectures(lectures);
    setItems(lectures ?? []);
  }

  // duration_seconds 가 0 인 영상에 대해 1회만 자동 감지 PATCH.
  useEffect(() => {
    if (!lectures) return;
    const targets = lectures.filter(
      (l) => (l.duration_seconds ?? 0) <= 0 && l.video_url && !probedRef.current.has(l.id),
    );
    if (targets.length === 0) return;

    const cleanups: Array<() => void> = [];
    // "배열 마지막 항목이 가장 나중에 끝난다"는 가정은 실제 metadata 로드
    // 순서와 무관해서 틀릴 수 있었음(파일 크기·네트워크 따라 순서 뒤바뀜) —
    // 대신 완료 개수를 세어 전부 끝났을 때 딱 한 번만 새로고침한다.
    let completed = 0;
    let refreshed = false;
    const maybeRefresh = async () => {
      completed += 1;
      if (completed >= targets.length && !refreshed) {
        refreshed = true;
        await onDurationDetected();
      }
    };

    for (const lec of targets) {
      probedRef.current.add(lec.id);
      const video = document.createElement("video");
      video.preload = "metadata";
      let cancelled = false;
      const handleMeta = async () => {
        if (cancelled) return;
        const dur = Math.round(video.duration);
        if (Number.isFinite(dur) && dur > 0) {
          try {
            await patchAdminLecture(lec.id, { duration_seconds: dur });
          } catch {
            /* 실패해도 dedup 유지 — 사용자가 수동 재시도 가능 */
          }
        }
        await maybeRefresh();
      };
      video.onloadedmetadata = handleMeta;
      video.onerror = () => {
        /* URL 깨짐 등 — PATCH 없이도 완료 카운트에는 반영 */
        if (!cancelled) void maybeRefresh();
      };
      cleanups.push(() => {
        cancelled = true;
        video.onloadedmetadata = null;
        video.onerror = null;
        video.removeAttribute("src");
      });
      // video_url 을 그대로 <video src> 에 넣으면, 운영 환경(S3 설정 시)처럼
      // video_url 이 공개 URL 이 아니라 비공개 오브젝트 키인 경우 로드가
      // 조용히 실패해 길이 자동 감지가 항상 안 됐다(2026-09, 버그 감사 중
      // 발견) — 학생용과 동일하게 서명된 재생 URL 을 먼저 받아온다.
      getAdminStreamUrl(lec.id)
        .then((res) => {
          if (!cancelled) video.src = res.url;
        })
        .catch(() => {
          if (!cancelled) video.onerror?.(new Event("error"));
        });
    }

    return () => {
      for (const fn of cleanups) fn();
    };
  }, [lectures, onDurationDetected]);

  if (lectures === undefined) {
    return <p className="px-2 text-xs text-slate-500">불러오는 중...</p>;
  }

  function handleDragStart(e: ReactDragEvent<HTMLTableRowElement>, idx: number) {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    // Firefox 호환: setData 호출 없으면 드래그 자체가 시작 안 됨
    e.dataTransfer.setData("text/plain", String(idx));
  }

  function handleDragOver(e: ReactDragEvent<HTMLTableRowElement>, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragIdx == null || dragIdx === idx) return;
    if (overIdx !== idx) setOverIdx(idx);
  }

  function handleDrop(e: ReactDragEvent<HTMLTableRowElement>, idx: number) {
    e.preventDefault();
    if (dragIdx == null || dragIdx === idx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setItems(next);
    setDragIdx(null);
    setOverIdx(null);
    void onReorder(next.map((l) => l.id));
  }

  function handleDragEnd() {
    setDragIdx(null);
    setOverIdx(null);
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-slate-200/60 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200/60 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-8 px-3 py-2.5"></th>
              <th className="w-12 px-3 py-2.5 text-center">순서</th>
              <th className="px-4 py-2.5">제목</th>
              <th className="w-20 px-4 py-2.5 text-right">시간</th>
              <th className="px-4 py-2.5">video URL</th>
              <th className="w-32 px-4 py-2.5 text-right">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  등록된 영상이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((lec, idx) => (
                <tr
                  key={lec.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`transition-colors ${
                    dragIdx === idx
                      ? "opacity-40"
                      : overIdx === idx
                        ? "bg-[var(--color-primary)]/5"
                        : "hover:bg-slate-50/80"
                  }`}
                >
                  <td className="px-3 py-3 text-center text-slate-400">
                    <GripVertical className="mx-auto h-3.5 w-3.5 cursor-grab active:cursor-grabbing" />
                  </td>
                  <td className="px-3 py-3 text-center font-medium text-slate-500">{idx + 1}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {lec.title}
                    {!lec.is_active ? (
                      <span className="ml-1.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 ring-1 ring-inset ring-slate-500/10">
                        비활성
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {formatDuration(lec.duration_seconds)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {lec.video_url ? (
                      <a
                        href={lec.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[10px] underline hover:text-[var(--color-primary)]"
                      >
                        {abbreviate(lec.video_url, 36)}
                      </a>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEdit(lec)}
                        className="rounded border border-slate-200 px-2 py-0.5 text-slate-600 hover:border-slate-400"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(lec)}
                        className="rounded border border-red-200 px-2 py-0.5 text-red-600 hover:border-red-400 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onAddClick}
          className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
        >
          + 영상 추가
        </button>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s}초`;
}

function abbreviate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return `…${s.slice(-(maxLen - 1))}`;
}

// ---------- modals ---------------------------------------------------------

// 강의 전체보기(frontend/src/app/(main)/courses/page.tsx)의 가격대 탭이
// 정확히 일치하는 가격만 필터링하므로, 이 값과 다른 가격을 입력하면 그
// 강의는 어느 탭에도 노출되지 않는다 — admin 에게 경고 문구를 보여주기 위한 목록.
const PRICE_TIER_VALUES = [22000, 33000, 55000];

const inputCls =
  "w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20";

// 폼에 변경사항이 있으면 닫기 전 확인
async function confirmClose(
  isDirty: boolean,
  onClose: () => void,
  confirmFn: (message: string) => Promise<boolean>,
) {
  if (isDirty && !(await confirmFn("변경사항이 저장되지 않았습니다. 그래도 닫으시겠습니까?"))) {
    return;
  }
  onClose();
}

function ModalShell({
  title,
  onClose,
  children,
  maxWidth = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    // 의도적으로 backdrop 클릭으로 닫지 않음 — 입력 도중 실수로 모달이 닫혀
    // 폼 내용이 사라지는 것을 방지. 닫으려면 우상단 "닫기" 버튼 또는 각 폼의
    // "취소" 버튼 사용.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl`}
      >
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-sans text-lg font-bold text-[var(--color-primary)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-900"
          >
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-zinc-800">{label}</label>
      {children}
    </div>
  );
}

function FormActions({
  onClose,
  submitting,
  submitLabel = "저장",
}: {
  onClose: () => void;
  submitting: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        disabled={submitting}
        className="rounded border border-zinc-300 px-4 py-2 text-sm text-slate-700"
      >
        취소
      </button>
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
      >
        {submitting ? "처리 중..." : submitLabel}
      </button>
    </div>
  );
}

function NewCourseModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const dialog = useDialog();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CourseCategory>(COURSE_CATEGORIES[0]);
  const [price, setPrice] = useState(110_000);
  const [hasDiscount, setHasDiscount] = useState(false);
  const [originalPrice, setOriginalPrice] = useState(110_000);
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [minProgressPct, setMinProgressPct] = useState(90);
  const [quizPassScore, setQuizPassScore] = useState(70);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isDirty = Boolean(title.trim() || description.trim());
  const safeClose = () => confirmClose(isDirty, onClose, dialog.confirm);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (hasDiscount && originalPrice <= price) {
      setErr("정가(할인 전)는 판매가보다 커야 합니다.");
      return;
    }
    if (minProgressPct < 0 || minProgressPct > 100) {
      setErr("수료 기준 진도율은 0~100 사이여야 합니다.");
      return;
    }
    if (quizPassScore < 0 || quizPassScore > 100) {
      setErr("퀴즈 합격 점수는 0~100 사이여야 합니다.");
      return;
    }
    setSubmitting(true);
    try {
      await createCourse({
        title: title.trim(),
        category,
        price,
        original_price: hasDiscount ? originalPrice : null,
        description: description.trim() || undefined,
        thumbnail_url: thumbnailUrl.trim() || undefined,
        min_progress_pct: minProgressPct,
        quiz_pass_score: quizPassScore,
      });
      onCreated();
    } catch (caught) {
      setErr(
        isAxiosError(caught)
          ? (caught.response?.data as { detail?: string } | undefined)?.detail ??
              "등록 실패"
          : "등록 실패",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="새 강의 등록" onClose={safeClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="제목">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="카테고리">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CourseCategory)}
            className={inputCls}
          >
            {COURSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="가격(원)">
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        {!PRICE_TIER_VALUES.includes(price) ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
            강의 전체보기 페이지의 가격대 탭(기본 강의 22,000 / 특수·단체 강의
            33,000 / 개별범죄 강의 55,000)은 정확히 일치하는 가격만 모아서
            보여줍니다. 이 가격은 어느 탭에도 속하지 않아 &quot;전체&quot;
            에서만 노출됩니다.
          </p>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasDiscount}
            onChange={(e) => setHasDiscount(e.target.checked)}
            className="accent-[var(--color-primary)]"
          />
          할인가로 표시 (정가에 취소선 + 판매가 노출)
        </label>
        {hasDiscount ? (
          <Field label="정가(할인 전, 원)">
            <input
              type="number"
              min={0}
              value={originalPrice}
              onChange={(e) => setOriginalPrice(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
        ) : null}
        <Field label="설명">
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputCls} resize-y`}
          />
        </Field>
        <Field label="썸네일 이미지 URL (선택)">
          <input
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder="https://... (비워두면 카테고리 기본 이미지 사용)"
            className={inputCls}
          />
        </Field>
        <Field label="수료 기준 진도율(%) (전체 차시 중 이 비율 이상 완료해야 수료)">
          <input
            type="number"
            min={0}
            max={100}
            value={minProgressPct}
            onChange={(e) => setMinProgressPct(Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        <Field label="퀴즈 합격 점수(점, 100점 만점)">
          <input
            type="number"
            min={0}
            max={100}
            value={quizPassScore}
            onChange={(e) => setQuizPassScore(Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <FormActions onClose={safeClose} submitting={submitting} submitLabel="등록" />
      </form>
    </ModalShell>
  );
}

function EditCourseModal({
  course,
  onClose,
  onSaved,
}: {
  course: CourseListItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useDialog();
  const [title, setTitle] = useState(course.title);
  const [category, setCategory] = useState<CourseCategory>(course.category);
  const [price, setPrice] = useState<number>(course.price ?? 0);
  const [hasDiscount, setHasDiscount] = useState(course.original_price != null);
  const [originalPrice, setOriginalPrice] = useState<number>(
    course.original_price ?? course.price ?? 0,
  );
  const [isActive, setIsActive] = useState(course.is_active);
  const [thumbnailUrl, setThumbnailUrl] = useState(course.thumbnail_url ?? "");
  // description/min_progress_pct/quiz_pass_score 는 list 응답에 없어 detail 을
  // 별도 fetch — 이전까지는 min_progress_pct/quiz_pass_score 를 아예 폼에서
  // 다루지 않아 관리자가 강의별 수료/합격 기준을 사이트에서 바꿀 방법이
  // 없었다(2026-09, 버그 감사 중 발견).
  const [description, setDescription] = useState<string>("");
  const [originalDescription, setOriginalDescription] = useState<string>("");
  const [minProgressPct, setMinProgressPct] = useState(90);
  const [originalMinProgressPct, setOriginalMinProgressPct] = useState(90);
  const [quizPassScore, setQuizPassScore] = useState(70);
  const [originalQuizPassScore, setOriginalQuizPassScore] = useState(70);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // fetch 가 끝나기 전에 admin이 이미 타이핑을 시작했으면, fetch 결과로
  // 그 입력을 덮어쓰지 않기 위한 플래그 (레이스 컨디션 방지).
  const descriptionTouched = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getCourseDetail(course.id)
      .then((d) => {
        if (cancelled) return;
        const desc = d.description ?? "";
        if (!descriptionTouched.current) setDescription(desc);
        setOriginalDescription(desc);
        setMinProgressPct(d.min_progress_pct);
        setOriginalMinProgressPct(d.min_progress_pct);
        setQuizPassScore(d.quiz_pass_score);
        setOriginalQuizPassScore(d.quiz_pass_score);
      })
      .catch(() => {
        /* description 미로드 시 빈 값 유지 — 저장 시 실수 방지 위해 dirty 검사가 막아줌 */
      });
    return () => {
      cancelled = true;
    };
  }, [course.id]);

  const isDirty =
    title !== course.title ||
    category !== course.category ||
    price !== (course.price ?? 0) ||
    hasDiscount !== (course.original_price != null) ||
    (hasDiscount && originalPrice !== (course.original_price ?? 0)) ||
    isActive !== course.is_active ||
    thumbnailUrl !== (course.thumbnail_url ?? "") ||
    description !== originalDescription ||
    minProgressPct !== originalMinProgressPct ||
    quizPassScore !== originalQuizPassScore;
  const safeClose = () => confirmClose(isDirty, onClose, dialog.confirm);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (hasDiscount && originalPrice <= price) {
      setErr("정가(할인 전)는 판매가보다 커야 합니다.");
      return;
    }
    if (minProgressPct < 0 || minProgressPct > 100) {
      setErr("수료 기준 진도율은 0~100 사이여야 합니다.");
      return;
    }
    if (quizPassScore < 0 || quizPassScore > 100) {
      setErr("퀴즈 합격 점수는 0~100 사이여야 합니다.");
      return;
    }
    setSubmitting(true);
    try {
      const trimmed = description.trim();
      await patchCourse(course.id, {
        title: title.trim(),
        category,
        price,
        original_price: hasDiscount ? originalPrice : null,
        is_active: isActive,
        description: trimmed === "" ? undefined : trimmed,
        thumbnail_url: thumbnailUrl.trim(),
        min_progress_pct: minProgressPct,
        quiz_pass_score: quizPassScore,
      });
      onSaved();
    } catch (caught) {
      setErr(
        isAxiosError(caught)
          ? (caught.response?.data as { detail?: string } | undefined)?.detail ??
              "수정 실패"
          : "수정 실패",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title={`강의 수정 (#${course.id})`} onClose={safeClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="제목">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="카테고리">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CourseCategory)}
            className={inputCls}
          >
            {COURSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="가격(원)">
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        {!PRICE_TIER_VALUES.includes(price) ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
            강의 전체보기 페이지의 가격대 탭(기본 강의 22,000 / 특수·단체 강의
            33,000 / 개별범죄 강의 55,000)은 정확히 일치하는 가격만 모아서
            보여줍니다. 이 가격은 어느 탭에도 속하지 않아 &quot;전체&quot;
            에서만 노출됩니다.
          </p>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasDiscount}
            onChange={(e) => setHasDiscount(e.target.checked)}
            className="accent-[var(--color-primary)]"
          />
          할인가로 표시 (정가에 취소선 + 판매가 노출)
        </label>
        {hasDiscount ? (
          <Field label="정가(할인 전, 원)">
            <input
              type="number"
              min={0}
              value={originalPrice}
              onChange={(e) => setOriginalPrice(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="accent-[var(--color-primary)]"
          />
          강의 활성화 (체크 해제 시 공개 목록에서 숨김)
        </label>
        <Field label="강의 설명">
          <textarea
            rows={4}
            value={description}
            onChange={(e) => {
              descriptionTouched.current = true;
              setDescription(e.target.value);
            }}
            placeholder="강의 소개 및 학습 목표를 입력하세요"
            className={`${inputCls} resize-y`}
          />
        </Field>
        <Field label="썸네일 이미지 URL (선택)">
          <input
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder="https://... (비워두면 카테고리 기본 이미지 사용)"
            className={inputCls}
          />
          {thumbnailUrl.trim() ? (
            <div className="mt-2 overflow-hidden rounded-lg border border-zinc-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailUrl.trim()}
                alt="썸네일 미리보기"
                className="aspect-video w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          ) : null}
        </Field>
        <Field label="수료 기준 진도율(%) (전체 차시 중 이 비율 이상 완료해야 수료)">
          <input
            type="number"
            min={0}
            max={100}
            value={minProgressPct}
            onChange={(e) => setMinProgressPct(Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        <Field label="퀴즈 합격 점수(점, 100점 만점)">
          <input
            type="number"
            min={0}
            max={100}
            value={quizPassScore}
            onChange={(e) => setQuizPassScore(Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <FormActions onClose={safeClose} submitting={submitting} />
      </form>
    </ModalShell>
  );
}

function NewLectureModal({
  course,
  onClose,
  onCreated,
}: {
  course: CourseListItem;
  onClose: () => void;
  onCreated: () => void;
}) {
  const dialog = useDialog();
  const [title, setTitle] = useState("");
  // 예전엔 여기 기본값이 "http://localhost:8000/static/videos/" 로 채워져
  // 있었는데, placeholder 가 아니라 실제 입력값이라 로컬이 아닌 환경에서
  // 관리자가 그 뒤에 파일명만 이어 붙이면 재생 불가능한 localhost URL 로
  // 영상이 등록되고 있었다(2026-09, 버그 감사 중 발견). 빈 값으로 시작하고
  // 형식 예시는 아래 placeholder 로만 안내한다.
  const [videoUrl, setVideoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isDirty = Boolean(title.trim()) || Boolean(videoUrl.trim());
  const safeClose = () => confirmClose(isDirty, onClose, dialog.confirm);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      // order_index 는 백엔드가 자동 부여 (기존 lecture 수 + 1)
      await addLecture(course.id, {
        title: title.trim(),
        video_url: videoUrl.trim() || undefined,
      });
      onCreated();
    } catch (caught) {
      setErr(
        isAxiosError(caught)
          ? (caught.response?.data as { detail?: string } | undefined)?.detail ??
              "추가 실패"
          : "추가 실패",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title={`영상 추가 (${course.title})`} onClose={safeClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="영상 제목">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="영상 파일 경로 (S3 오브젝트 키)">
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="lectures/school/01.mp4"
            className={`${inputCls} font-mono text-xs`}
          />
          <p className="text-xs text-zinc-500">
            http:// 로 시작하는 전체 URL이 아니라, S3 버킷 안에서의 파일
            경로만 입력하세요(예: lectures/카테고리/파일명.mp4). 영상 길이는
            등록 후 자동으로 감지됩니다. 순서는 자동 부여되며, 추가 후
            목록에서 드래그로 변경할 수 있습니다.
          </p>
        </Field>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <FormActions onClose={safeClose} submitting={submitting} submitLabel="추가" />
      </form>
    </ModalShell>
  );
}

function EditLectureModal({
  lecture,
  onClose,
  onSaved,
}: {
  lecture: AdminLectureFull;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useDialog();
  const [title, setTitle] = useState(lecture.title);
  const [orderIndex, setOrderIndex] = useState(lecture.order_index);
  const [videoUrl, setVideoUrl] = useState(lecture.video_url ?? "");
  const [isActive, setIsActive] = useState(lecture.is_active);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isDirty =
    title !== lecture.title ||
    orderIndex !== lecture.order_index ||
    videoUrl !== (lecture.video_url ?? "") ||
    isActive !== lecture.is_active;
  const safeClose = () => confirmClose(isDirty, onClose, dialog.confirm);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await patchAdminLecture(lecture.id, {
        title: title.trim(),
        order_index: orderIndex,
        video_url: videoUrl.trim() || null,
        is_active: isActive,
      });
      onSaved();
    } catch (caught) {
      setErr(
        isAxiosError(caught)
          ? (caught.response?.data as { detail?: string } | undefined)?.detail ??
              "수정 실패"
          : "수정 실패",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title={`영상 수정 (#${lecture.id})`} onClose={safeClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="영상 제목">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="영상 파일 경로 (S3 오브젝트 키)">
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="lectures/school/01.mp4"
            className={`${inputCls} font-mono text-xs`}
          />
          <p className="text-xs text-zinc-500">
            http:// 로 시작하는 전체 URL이 아니라 S3 버킷 안에서의 파일
            경로만 입력하세요. 영상 길이는 등록 후 자동으로 갱신됩니다.
          </p>
        </Field>
        <Field label="순서">
          <input
            type="number"
            min={0}
            value={orderIndex}
            onChange={(e) => setOrderIndex(Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="accent-[var(--color-primary)]"
          />
          영상 활성화
        </label>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <FormActions onClose={safeClose} submitting={submitting} />
      </form>
    </ModalShell>
  );
}

// ---------- quiz modal -----------------------------------------------------

type QuestionDraft = {
  question_text: string;
  options: { option_text: string; correct: boolean }[];
};

function blankQuestion(): QuestionDraft {
  return {
    question_text: "",
    options: [
      { option_text: "", correct: true },
      { option_text: "", correct: false },
      { option_text: "", correct: false },
      { option_text: "", correct: false },
    ],
  };
}

function QuizModal({
  course,
  existing,
  onClose,
  onSaved,
}: {
  course: CourseListItem;
  existing: AdminQuizRead | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useDialog();
  const isEdit = !!existing?.exists;
  const initialQuestions = useMemo<QuestionDraft[]>(() => {
    if (existing?.exists && existing.questions.length > 0) {
      return existing.questions.map((q) => ({
        question_text: q.question_text,
        options: q.options.map((o) => ({
          option_text: o.option_text,
          correct: o.is_correct,
        })),
      }));
    }
    return [blankQuestion()];
  }, [existing]);
  const [questions, setQuestions] = useState<QuestionDraft[]>(initialQuestions);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isDirty = JSON.stringify(questions) !== JSON.stringify(initialQuestions);
  const safeClose = () => confirmClose(isDirty, onClose, dialog.confirm);

  function addQuestion() {
    setQuestions((prev) => [...prev, blankQuestion()]);
  }

  function removeQuestion(qi: number) {
    setQuestions((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== qi),
    );
  }

  function updateQuestion(qi: number, text: string) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qi ? { ...q, question_text: text } : q)),
    );
  }

  function updateOption(qi: number, oi: number, text: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi
          ? {
              ...q,
              options: q.options.map((o, j) =>
                j === oi ? { ...o, option_text: text } : o,
              ),
            }
          : q,
      ),
    );
  }

  function setCorrect(qi: number, oi: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi
          ? { ...q, options: q.options.map((o, j) => ({ ...o, correct: j === oi })) }
          : q,
      ),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const payload: AdminQuizQuestion[] = questions.map((q) => ({
        question_text: q.question_text.trim(),
        options: q.options.map((o) => ({
          option_text: o.option_text.trim(),
          is_correct: o.correct,
        })),
      }));
      await setQuiz(course.id, payload);
      onSaved();
    } catch (caught) {
      setErr(
        isAxiosError(caught)
          ? (caught.response?.data as { detail?: string } | undefined)?.detail ??
              "저장 실패"
          : "저장 실패",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title={`${isEdit ? "퀴즈 수정" : "퀴즈 등록"} (${course.title})`}
      onClose={safeClose}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          ⚠️ 저장 시 기존 퀴즈는 전체 교체됩니다.
          {isEdit ? " 기존 응시 기록은 그대로 보존됩니다." : ""}
        </p>
        {questions.map((q, qi) => (
          <div key={qi} className="space-y-2 rounded-lg border border-zinc-200 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-500">문제 {qi + 1}</p>
              {questions.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeQuestion(qi)}
                  className="text-[11px] text-red-500 hover:underline"
                >
                  삭제
                </button>
              ) : null}
            </div>
            <input
              required
              value={q.question_text}
              onChange={(e) => updateQuestion(qi, e.target.value)}
              placeholder="문제를 입력하세요"
              className={inputCls}
            />
            <div className="space-y-1.5">
              {q.options.map((o, oi) => (
                <label
                  key={oi}
                  className="flex items-center gap-2 rounded border border-zinc-200 px-3 py-1.5 text-sm"
                >
                  <input
                    type="radio"
                    name={`q-${qi}-correct`}
                    checked={o.correct}
                    onChange={() => setCorrect(qi, oi)}
                    className="accent-[var(--color-primary)]"
                  />
                  <input
                    required
                    value={o.option_text}
                    onChange={(e) => updateOption(qi, oi, e.target.value)}
                    placeholder={`선택지 ${oi + 1}`}
                    className="flex-1 border-none bg-transparent text-sm focus:outline-none"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addQuestion}
          className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
        >
          + 문제 추가
        </button>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <FormActions
          onClose={safeClose}
          submitting={submitting}
          submitLabel={isEdit ? "수정 저장" : "등록"}
        />
      </form>
    </ModalShell>
  );
}
