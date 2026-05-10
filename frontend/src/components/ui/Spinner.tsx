// 단순 border-circle 로더. lucide 의 Loader2 와는 별개로, 풀스크린 또는
// 인라인 버튼에서 사용하던 수동 spinner div 를 통일한다.

type Size = "xs" | "sm" | "md";
type Tone = "primary" | "accent" | "white";

const SIZE_CLASS: Record<Size, string> = {
  xs: "h-5 w-5 border-2",
  sm: "h-8 w-8 border-4",
  md: "h-10 w-10 border-4",
};

const TONE_CLASS: Record<Tone, string> = {
  primary: "border-slate-200 border-t-[var(--color-primary)]",
  accent: "border-slate-200 border-t-[var(--color-accent)]",
  white: "border-white/30 border-t-white",
};

interface Props {
  size?: Size;
  tone?: Tone;
  className?: string;
}

export function Spinner({ size = "md", tone = "accent", className = "" }: Props) {
  return (
    <div
      role="status"
      aria-label="로딩 중"
      className={`animate-spin rounded-full ${SIZE_CLASS[size]} ${TONE_CLASS[tone]} ${className}`}
    />
  );
}
