import { Star } from "lucide-react";

// 소수점 별점(4.98 등)을 별 다섯 개에 비율대로 채워 그린다.
export function Stars({
  value,
  className = "h-4 w-4",
  emptyClassName = "fill-slate-200 text-slate-200",
}: {
  value: number;
  className?: string;
  emptyClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`별점 5점 만점에 ${value}점`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className={`relative inline-block shrink-0 ${className}`}>
            <Star className={`absolute inset-0 ${className} ${emptyClassName}`} aria-hidden />
            <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={`max-w-none ${className} fill-amber-400 text-amber-400`} aria-hidden />
            </span>
          </span>
        );
      })}
    </span>
  );
}
