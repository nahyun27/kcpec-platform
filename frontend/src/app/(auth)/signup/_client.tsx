"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { signup } from "@/lib/api";
import { getCookie, LAWYER_REFERRAL_COOKIE } from "@/lib/cookies";
import { Loader2 } from "lucide-react";
import { SocialLoginButtons } from "../_social";

type FormState = {
  username: string;
  password: string;
  passwordConfirm: string;
  email: string;
  birthDate: string;
};

const initialState: FormState = {
  username: "",
  password: "",
  passwordConfirm: "",
  email: "",
  birthDate: "",
};

// login/_client.tsx 의 safeNext 와 동일 — `?next=` 는 같은 origin 의 절대경로만
// 허용(open-redirect 방지). 파일별로 각자 두는 기존 관례를 그대로 따름.
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export default function SignupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (form.password !== form.passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setSubmitting(true);
    try {
      await signup({
        username: form.username,
        password: form.password,
        email: form.email,
        birth_date: form.birthDate,
        // 변호사 추천 링크(/r/코드)로 들어온 적이 있으면 쿠키에 남아있다 —
        // 있으면 가입 즉시 계정에 연결돼 결제 화면 코드 입력칸이 자동으로
        // 채워진다.
        lawyer_referral_code: getCookie(LAWYER_REFERRAL_COOKIE),
      });
      // 가입 즉시 로그인 상태가 되므로(signup() 내부에서 토큰 세팅), /login?next=...
      // 을 거치지 않고 바로 next 로 이동 — 예전엔 무조건 "/" 로 보내서, 로그인 안
      // 된 채 결제하려다 회원가입까지 한 사용자가 원래 하려던 결제 화면으로
      // 못 돌아가고 홈으로 튕기는 문제가 있었다(2026-09, 네이버 광고 전환추적
      // URL 확인 중 발견).
      router.push(next);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6 text-center lg:text-left">
        <h1 className="font-sans text-3xl font-extrabold tracking-tight text-slate-900">
          회원가입
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          간단한 정보 입력으로 교육을 시작하세요.
        </p>
      </div>

      <div className="mb-6">
        <Suspense fallback={null}>
          <SocialLoginButtons />
        </Suspense>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <Field label="아이디" htmlFor="username">
          <input
            id="username"
            name="username"
            type="text"
            required
            minLength={4}
            maxLength={50}
            pattern="[A-Za-z0-9_]+"
            autoComplete="username"
            value={form.username}
            onChange={(e) => update("username", e.target.value)}
            className={inputClass}
            placeholder="영문/숫자/언더스코어 4자 이상"
          />
        </Field>

        <Field label="비밀번호" htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            className={inputClass}
            placeholder="8자 이상"
          />
        </Field>

        <Field label="비밀번호 확인" htmlFor="passwordConfirm">
          <input
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.passwordConfirm}
            onChange={(e) => update("passwordConfirm", e.target.value)}
            className={inputClass}
            placeholder="비밀번호를 다시 입력해주세요"
          />
        </Field>

        <Field label="이메일" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className={inputClass}
            placeholder="example@kcpec.kr"
          />
        </Field>

        <Field label="생년월일" htmlFor="birthDate">
          <input
            id="birthDate"
            name="birthDate"
            type="date"
            required
            value={form.birthDate}
            onChange={(e) => update("birthDate", e.target.value)}
            className={inputClass}
          />
        </Field>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 shadow-sm">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 flex w-full items-center justify-center rounded-xl bg-[var(--color-primary)] py-3.5 font-bold text-white shadow-md shadow-[var(--color-primary)]/20 transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] hover:shadow-lg hover:shadow-[var(--color-primary)]/30 disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              가입 중...
            </>
          ) : (
            "가입하기"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm font-medium text-slate-500 lg:text-left">
        이미 계정이 있으신가요?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-bold text-[var(--color-accent)] hover:underline"
        >
          로그인
        </Link>
      </p>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-900 transition-all placeholder:text-zinc-400 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-bold text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}
