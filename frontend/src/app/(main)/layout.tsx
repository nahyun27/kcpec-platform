import SiteHeader from "@/components/layout/SiteHeader";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1 bg-[var(--color-muted)]">{children}</main>
    </div>
  );
}
