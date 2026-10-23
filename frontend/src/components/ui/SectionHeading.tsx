import type { ReactNode } from "react";

// 페이지 안 섹션 제목을 한 가지 모양으로 맞추기 위한 공통 부품(2026-10).
// eyebrow(작은 영문/분류 표시) → 제목 → 설명 순서. align 으로 가운데/왼쪽.
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  tone = "light",
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "center" | "left";
  tone?: "light" | "dark";
  action?: ReactNode;
}) {
  const center = align === "center";
  const dark = tone === "dark";
  return (
    <div
      className={`mb-8 flex flex-col gap-4 md:mb-12 ${
        center ? "items-center text-center" : "md:flex-row md:items-end md:justify-between"
      }`}
    >
      <div className={center ? "max-w-2xl" : "max-w-3xl"}>
        {eyebrow ? (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] ${
              dark
                ? "bg-white/10 text-blue-100 ring-1 ring-white/15"
                : "bg-blue-50 text-[var(--color-accent)] ring-1 ring-blue-600/15"
            }`}
          >
            {eyebrow}
          </span>
        ) : null}
        <h2
          className={`mt-3 text-balance font-sans text-[26px] font-extrabold leading-tight tracking-tight sm:text-[32px] ${
            dark ? "text-white" : "text-slate-900"
          }`}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={`mt-3 text-[15px] leading-relaxed sm:text-base ${
              dark ? "text-slate-300" : "text-slate-500"
            }`}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
