"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { resetPassword } from "@/lib/api";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "비밀번호 변경에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="w-full text-center lg:text-left">
        <h1 className="font-sans text-2xl font-extrabold tracking-tight text-slate-900">
          잘못된 접근입니다
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          비밀번호 재설정 링크가 올바르지 않습니다. 다시 요청해 주세요.
        </p>
        <Link
          href="/forgot-password"
          className="mt-8 inline-block font-bold text-[var(--color-primary)] hover:underline"
        >
          비밀번호 찾기로 이동
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="w-full text-center lg:text-left">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 lg:mx-0">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="font-sans text-2xl font-extrabold tracking-tight text-slate-900">
          비밀번호가 변경되었습니다
        </h1>
        <p className="mt-3 text-sm text-slate-500">잠시 후 로그인 페이지로 이동합니다...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8 text-center lg:text-left">
        <h1 className="font-sans text-3xl font-extrabold tracking-tight text-slate-900">
          새 비밀번호 설정
        </h1>
        <p className="mt-3 text-sm text-slate-500">사용하실 새 비밀번호를 입력해 주세요.</p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label htmlFor="newPassword" className="block text-sm font-bold text-slate-700">
            새 비밀번호
          </label>
          <input
            id="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-900 transition-all placeholder:text-zinc-400 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10"
            placeholder="8자 이상 입력하세요"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="block text-sm font-bold text-slate-700">
            새 비밀번호 확인
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-900 transition-all placeholder:text-zinc-400 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10"
            placeholder="비밀번호를 다시 입력하세요"
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
              변경 중...
            </>
          ) : (
            "비밀번호 변경"
          )}
        </button>
      </form>
    </div>
  );
}
