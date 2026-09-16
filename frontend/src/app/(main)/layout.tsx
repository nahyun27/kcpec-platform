import SiteHeader from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 회색 배경(--color-muted)을 main 에만 주면, 떠 있는 둥근 헤더 캡슐
    // 주변 여백은 배경색이 안 먹어 body 기본색(흰색)이 그대로 비쳐 헤더
    // 뒤로 흰색 자국이 보였다 — 래퍼 전체에 배경을 줘서 헤더 주변도 같은
    // 회색이 되게 한다(2026-09, 실사용 중 발견). 푸터는 자체 진한 배경색이
    // 따로 있어 영향 없음.
    <div className="flex min-h-full flex-1 flex-col bg-[var(--color-muted)]">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
