import type { Metadata } from "next";
import { GA4 } from "@/components/analytics/GA4";
import { DialogProvider } from "@/components/ui/DialogProvider";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const TITLE = "한국범죄예방교육센터 KCPEC | 재범방지교육·수료증·양형자료·심리상담";
const DESCRIPTION =
  "재범방지교육 온라인 수강 후 법원·검찰 제출용 수료증을 발급받으세요. 음주운전·성범죄·폭력·마약·도박 등 사건별 감형 참고자료(양형자료), 심리상담 의견서, 서약서, 반성문, 탄원서까지 준비할 수 있습니다.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "재범방지교육",
    "재범방지교육 수료증",
    "수료증 발급",
    "범죄예방교육",
    "양형자료",
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
        <GA4 />
        <DialogProvider>{children}</DialogProvider>
      </body>
    </html>
  );
}
