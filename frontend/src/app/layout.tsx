import type { Metadata } from "next";
import { GA4 } from "@/components/analytics/GA4";
import "./globals.css";

export const metadata: Metadata = {
  title: "한국범죄예방교육센터 KCPEC",
  description: "심리·준법교육 온라인 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-foreground">
        <GA4 />
        {children}
      </body>
    </html>
  );
}
