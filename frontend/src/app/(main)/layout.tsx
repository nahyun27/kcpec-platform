import SiteHeader from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { FloatingContact } from "@/components/layout/FloatingContact";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1 bg-[var(--color-muted)]">{children}</main>
      <SiteFooter />
      <FloatingContact />
    </div>
  );
}
