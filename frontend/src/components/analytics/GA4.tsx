"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/**
 * GA4 통합 — gtag.js 로드 + 라우트 변경 시 page_view 이벤트 발사.
 * NEXT_PUBLIC_GA_MEASUREMENT_ID 가 비어있으면 아무것도 렌더하지 않는다.
 */
export function GA4() {
  if (!GA_ID) return null;
  return (
    <>
      <Script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: false });
        `}
      </Script>
      {/* Suspense 로 감싸야 use(use(SearchParams)) 가 정적 export 환경에서 안전 */}
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
    </>
  );
}

function PageviewTracker() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    if (!GA_ID || typeof window === "undefined" || !window.gtag) return;
    const qs = search.toString();
    const page = qs ? `${pathname}?${qs}` : pathname;
    window.gtag("event", "page_view", {
      page_path: page,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, search]);

  return null;
}
