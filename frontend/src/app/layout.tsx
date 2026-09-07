import type { Metadata } from "next";
import { GA4 } from "@/components/analytics/GA4";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const TITLE = "한국범죄예방교육센터 KCPEC";
const DESCRIPTION =
  "범죄예방교육 및 전문가 심리상담, 양형자료 준비, 교육수료증, 심리상담 의견서 발급 플랫폼";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
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
        {children}
      </body>
    </html>
  );
}
