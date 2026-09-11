"use client";

import { useEffect, useRef, useState } from "react";

// 섹션이 뷰포트에 처음 들어올 때 한 번만 fade+slide-up 시키는 용도.
// tailwindcss-animate 의 1회성 keyframe 대신, IntersectionObserver 로 감지한
// 상태를 그대로 transition 클래스에 반영하는 방식 — 스크롤 위치에 따라
// on/off 를 재계산할 필요 없이 "본 적 있는지"만 기억하면 되기 때문에 더 단순함.
// 서버 컴포넌트(예: metadata 를 export 하는 페이지)에서도 클라이언트
// 컴포넌트를 children 째로 감싸 쓸 수 있어 이 파일만 별도로 분리해뒀다.
function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
  id,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li";
  id?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <Tag
      ref={ref as never}
      id={id}
      className={`transition-all duration-700 ease-out ${
        inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
