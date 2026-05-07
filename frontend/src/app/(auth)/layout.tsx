import Link from "next/link";
import { ShieldCheck, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* Left Column - Brand & Messaging (Hidden on mobile) */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[var(--color-primary)] p-12 lg:flex">
        {/* Decorative Background Elements */}
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        ></div>
        <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-[var(--color-accent)] opacity-20 blur-[100px]"></div>
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-blue-600 opacity-20 blur-[120px]"></div>

        <div className="relative z-10">
          <Link
            href="/"
            className="flex items-center gap-2 font-sans text-2xl font-extrabold tracking-tight text-white transition-opacity hover:opacity-90"
          >
            <ShieldCheck className="h-8 w-8 text-[var(--color-accent)]" />
            <span>KCPEC</span>
          </Link>
        </div>

        <div className="relative z-10 mb-20 space-y-8">
          <div className="space-y-4">
            <h1 className="font-sans text-4xl font-extrabold leading-tight text-white">
              가장 확실한 <br />
              <span className="text-[var(--color-accent)]">양형 자료 준비</span>의 시작
            </h1>
            <p className="text-lg leading-relaxed text-slate-300">
              법원 및 수사기관 제출용 전문 교육과<br />
              심리 상담을 한 곳에서 해결하세요.
            </p>
          </div>

          <div className="space-y-4 pt-8">
            <FeatureItem text="전문가 감수 100% 신뢰성 검증 교육" />
            <FeatureItem text="교육 수료 즉시 수료증 당일 발급" />
            <FeatureItem text="철저한 개인정보 보호 시스템" />
          </div>
        </div>

        <div className="relative z-10 text-sm text-slate-400">
          ⓒ {new Date().getFullYear()} 한국범죄예방교육센터. All rights reserved.
        </div>
      </div>

      {/* Right Column - Auth Form */}
      <div className="flex w-full flex-col items-center justify-center bg-slate-50 px-6 py-12 lg:w-1/2 lg:bg-white">
        {/* Mobile Header (Visible only on mobile) */}
        <div className="mb-10 flex w-full max-w-md items-center justify-between lg:hidden">
          <Link
            href="/"
            className="flex items-center gap-2 font-sans text-2xl font-extrabold tracking-tight text-[var(--color-primary)]"
          >
            <ShieldCheck className="h-7 w-7 text-[var(--color-accent)]" />
            <span>KCPEC</span>
          </Link>
        </div>

        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[var(--color-primary)] lg:hidden">
            <ArrowLeft className="h-4 w-4" />
            홈으로 돌아가기
          </Link>
          
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl shadow-slate-200/50 sm:p-10 lg:border-none lg:bg-transparent lg:p-0 lg:shadow-none">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
        <CheckCircle2 className="h-4 w-4" />
      </div>
      <span className="font-medium text-slate-200">{text}</span>
    </div>
  );
}
