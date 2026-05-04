import Link from "next/link";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link
            href="/"
            className="font-serif text-xl font-bold text-[var(--color-primary)]"
          >
            한국범죄예방교육센터
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium text-zinc-700">
            <Link href="/courses" className="hover:text-[var(--color-primary)]">
              강의 목록
            </Link>
            <Link
              href="/login"
              className="rounded bg-[var(--color-primary)] px-4 py-2 text-white hover:bg-[var(--color-primary-hover)]"
            >
              로그인
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 bg-[var(--color-muted)]">{children}</main>
    </div>
  );
}
