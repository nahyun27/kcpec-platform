import Script from "next/script";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

/**
 * 구글 태그 매니저(GTM) 컨테이너 — 광고대행사가 전환추적(구글 애즈 등) 태그를
 * 코드 배포 없이 GTM 콘솔에서 직접 추가·수정할 수 있게 하기 위한 용도.
 * GA4(components/analytics/GA4.tsx)와는 별개로 동작 — GA4 는 gtag.js 를 직접
 * 로드하고, 이 컨테이너는 광고 전환추적 등 추가 태그만 담당한다(둘 다 유지해도
 * 문제 없음. GA4 태그까지 GTM 안으로 옮기는 건 별도 정리 작업).
 * NEXT_PUBLIC_GTM_ID(형식: GTM-XXXXXXX) 가 비어있으면 아무것도 렌더하지 않는다.
 */
export function GTM() {
  if (!GTM_ID) return null;
  return (
    <Script id="gtm-init" strategy="afterInteractive">
      {`
        (function(w,d,s,l,i){
          w[l]=w[l]||[];
          w[l].push({'gtm.start': new Date().getTime(), event: 'gtm.js'});
          var f=d.getElementsByTagName(s)[0], j=d.createElement(s), dl=l!='dataLayer'?'&l='+l:'';
          j.async=true;
          j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
          f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${GTM_ID}');
      `}
    </Script>
  );
}

/**
 * <body> 여는 태그 바로 다음에 둬야 하는 GTM 의 noscript 폴백(JS 비활성 브라우저용).
 * GTM 공식 설치 가이드가 요구하는 표준 위치 — RootLayout 의 <body> 첫 자식으로 사용.
 */
export function GTMNoScript() {
  if (!GTM_ID) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
