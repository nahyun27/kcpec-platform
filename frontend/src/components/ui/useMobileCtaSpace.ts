"use client";

import { useEffect } from "react";

// 화면 아래 고정 바(모바일)가 떠 있는 동안 body 아래에 여백을 둔다(globals.css).
export function useMobileCtaSpace(active = true) {
  useEffect(() => {
    if (!active) return;
    document.body.classList.add("has-mobile-cta");
    return () => document.body.classList.remove("has-mobile-cta");
  }, [active]);
}
