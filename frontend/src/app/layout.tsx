import type { Metadata } from "next";
import { GA4 } from "@/components/analytics/GA4";
import { GTM, GTMNoScript } from "@/components/analytics/GTM";
import { DialogProvider } from "@/components/ui/DialogProvider";
import "./globals.css";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationLd, websiteLd } from "@/lib/seo";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const TITLE = "한국범죄예방교육센터 KCPEC | 재범방지교육·양형자료 수료증·심리상담";
const DESCRIPTION =
  "재범방지교육 온라인 수강 후 법원·검찰 제출용 수료증을 발급받으세요. 음주운전·성범죄·폭력·마약·도박 등 사건별 감형 참고자료(양형자료), 심리상담 의견서, 서약서까지 준비할 수 있습니다.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // 페이지마다 자기 주소를 정식 주소로 알린다("./" = 현재 경로). 쿼리 붙은 주소·
  // www 등으로 들어와도 구글이 kcpec.co.kr 의 한 주소로 모아서 평가하게 한다.
  alternates: { canonical: "./" },
  // 구글 서치콘솔 소유 확인(2026-11)
  verification: { google: "86tpjMvlJ9tFR8Mp7Dm9LaYLBxv6HKW1iVPo0W33RN4" },
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "재범방지교육",
    "재범방지교육 수료증",
    "수료증 발급",
    "범죄예방교육",
    "양형자료",
    "양형자료 수료증",
    "감형자료",
    "반성문",
    "수료증",
    "심리상담 소견서",
    "음주운전 재범방지교육",
    "성범죄 재범방지교육",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: TITLE,
    url: SITE_URL,
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-white text-foreground"
      >
        {/* 회사·사이트 정보 — 검색엔진과 AI 검색이 "이 사이트가 누구인지" 읽는 용도 */}
        <JsonLd data={organizationLd()} />
        <JsonLd data={websiteLd()} />
        <GTMNoScript />
        <GTM />
        <GA4 />
        <DialogProvider>{children}</DialogProvider>
      </body>
    </html>
  );
}
