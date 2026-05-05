import Link from "next/link";
import HeaderNav from "./HeaderNav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md shadow-sm transition-all duration-300">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link
            href="/"
            className="font-sans text-xl font-bold text-[var(--color-primary)]"
          >
            한국범죄예방교육센터
          </Link>
          <HeaderNav />
        </div>
      </header>
      <main className="flex-1 bg-[var(--color-muted)]">{children}</main>
    </div>
  );
}
