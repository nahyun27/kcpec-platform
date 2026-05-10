"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { X } from "lucide-react";

// 모달의 6개 chip — 5개 실제 카테고리 + "기타" (전체 보기 트리거).
// "기타" 는 카테고리 enum 에 없는 가상 옵션으로, 라우팅 시 무시한다.
const CHIPS = ["성범죄", "폭력", "재산범죄", "약물·도박", "교통", "기타"] as const;
const OTHER = "기타";
const CURATION_SEEN_KEY = "curation_seen";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 사용자가 자신의 사건과 관련된 카테고리를 빠르게 선택해 강의 목록으로
 * 진입할 수 있게 도와주는 큐레이션 모달. 비로그인 첫 방문자에게 자동
 * 노출(부모 page 가 게이팅) 되며, 헤더 배너로 재호출 가능.
 */
export function CurationModal({ isOpen, onClose }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  function toggle(chip: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      return next;
    });
  }

  function markSeen() {
    try {
      window.localStorage.setItem(CURATION_SEEN_KEY, "1");
    } catch {
      /* private mode 등 — 게이팅 실패해도 동작에는 영향 없음 */
    }
  }

  function handleConfirm() {
    markSeen();
    // "기타" 는 필터에 사용하지 않음. 실제 카테고리 중 첫 번째 선택값만
    // 라우팅에 사용 (복수 선택 정책: 첫 값 우선).
    const real = CHIPS.filter((c) => c !== OTHER && selected.has(c));
    const target = real.length > 0 ? `/courses?category=${encodeURIComponent(real[0])}` : "/courses";
    onClose();
    router.push(target);
  }

  function handleSkip() {
    markSeen();
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="강의 추천"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleSkip}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleSkip}
          aria-label="닫기"
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-1 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--color-primary)] ring-1 ring-inset ring-blue-500/20">
          Curation
        </div>
        <h2 className="mt-3 font-sans text-2xl font-extrabold leading-tight text-slate-900 sm:text-[26px]">
          어떤 교육이 필요하신가요?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          관심 분야를 선택하시면 적합한 강의로 안내해 드립니다. 여러 개 선택할 수 있어요.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {CHIPS.map((c) => {
            const active = selected.has(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggle(c)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
                  active
                    ? "bg-[#1C3461] text-white border border-[#1C3461] shadow-sm"
                    : "border border-zinc-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          className="mt-7 w-full rounded-lg bg-[#1C3461] py-3 text-sm font-bold text-white shadow-md shadow-[#1C3461]/20 transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)]"
        >
          맞춤 강의 보기
        </button>
        <button
          type="button"
          onClick={handleSkip}
          className="mt-3 w-full text-center text-sm text-slate-400 hover:text-slate-600"
        >
          건너뛰기
        </button>
      </div>
    </div>
  );
}
