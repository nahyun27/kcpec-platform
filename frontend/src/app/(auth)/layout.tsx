import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[var(--color-muted)] px-4 py-12">
      <Link
        href="/"
        className="mb-8 font-sans text-2xl font-bold text-[var(--color-primary)]"
      >
        한국범죄예방교육센터
      </Link>
      <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-white p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}
