"use client";

import { useEffect, useRef, useState } from "react";

// "15,000+", "25개 과정", "100% 검증" 처럼 앞에 숫자가 있는 문구에서 숫자 부분만
// 화면에 들어올 때 0부터 올라가게 보여준다. 숫자가 없으면 그대로 출력한다.
// 최종 값은 처음부터 글자 폭을 잡아 두어(투명한 최종 문구) 자리가 흔들리지 않는다.
export function CountUp({ value, durationMs = 1200 }: { value: string; durationMs?: number }) {
  const match = value.match(/^([\d,]+)(.*)$/);
  const target = match ? Number(match[1].replace(/,/g, "")) : null;
  const ref = useRef<HTMLSpanElement | null>(null);
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || target == null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          const eased = 1 - Math.pow(1 - t, 3);
          setShown(Math.round(target * eased));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target, durationMs]);

  if (!match || target == null) return <>{value}</>;
  const text = shown == null ? value : `${shown.toLocaleString("ko-KR")}${match[2]}`;
  return (
    <span ref={ref} className="relative inline-block">
      <span className="invisible" aria-hidden>
        {value}
      </span>
      <span className="absolute inset-0 text-center tabular-nums" aria-label={value}>
        {text}
      </span>
    </span>
  );
}
