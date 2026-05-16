"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { login } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { SocialLoginButtons } from "../_social";

// `?next=` 는 같은 origin 의 절대경로만 허용 (open-redirect 방지).
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ username, password });
      router.push(next);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "로그인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-8 text-center lg:text-left">
        <h1 className="font-sans text-3xl font-extrabold tracking-tight text-slate-900">
          로그인
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          서비스 이용을 위해 아이디와 비밀번호를 입력해 주세요.
        </p>
      </div>

      {/* 소셜 로그인 — 위에 배치 */}
      <div className="mb-6">
        <SocialLoginButtons />
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label htmlFor="username" className="block text-sm font-bold text-slate-700">
            아이디
          </label>
          <input
            id="username"
            type="text"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-900 transition-all placeholder:text-zinc-400 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10"
            placeholder="아이디를 입력하세요"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-bold text-slate-700">
              비밀번호
            </label>
            <Link href="#" className="text-xs font-semibold text-[var(--color-primary)] hover:underline">
              비밀번호 찾기
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-900 transition-all placeholder:text-zinc-400 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10"
            placeholder="비밀번호를 입력하세요"
          />
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 shadow-sm">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 flex w-full items-center justify-center rounded-xl bg-[var(--color-primary)] py-3.5 font-bold text-white shadow-md shadow-[var(--color-primary)]/20 transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] hover:shadow-lg hover:shadow-[var(--color-primary)]/30 disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              로그인 중...
            </>
          ) : (
            "로그인"
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-sm font-medium text-slate-500 lg:text-left">
        아직 계정이 없으신가요?{" "}
        <Link href="/signup" className="font-bold text-[var(--color-accent)] hover:underline">
          회원가입
        </Link>
      </p>
    </div>
  );
}
