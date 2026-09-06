"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { forgotPassword } from "@/lib/api";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "요청에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="w-full text-center lg:text-left">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] lg:mx-0">
          <MailCheck className="h-7 w-7" />
        </div>
        <h1 className="font-sans text-2xl font-extrabold tracking-tight text-slate-900">
          이메일을 확인해 주세요
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          <strong className="text-slate-700">{email}</strong> 주소로 가입된 계정이 있다면
          비밀번호 재설정 링크를 보내드렸습니다. 메일함(스팸함 포함)을 확인해 주세요.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[var(--color-primary)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          로그인으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8 text-center lg:text-left">
        <h1 className="font-sans text-3xl font-extrabold tracking-tight text-slate-900">
          비밀번호 찾기
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-bold text-slate-700">
            이메일
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-900 transition-all placeholder:text-zinc-400 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10"
            placeholder="가입하신 이메일을 입력하세요"
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
              전송 중...
            </>
          ) : (
            "재설정 링크 보내기"
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-sm font-medium text-slate-500 lg:text-left">
        <Link href="/login" className="font-bold text-[var(--color-accent)] hover:underline">
          로그인으로 돌아가기
        </Link>
      </p>
    </div>
  );
}
