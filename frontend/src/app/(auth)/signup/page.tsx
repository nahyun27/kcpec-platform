"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { signup } from "@/lib/api";

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

export default function SignupPage() {
  const router = useRouter();
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
      });
      router.push("/");
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSocial(provider: "kakao" | "naver") {
    // TODO: NextAuth signIn(provider) 활성화 후 연결
    alert(`${provider === "kakao" ? "카카오" : "네이버"} 간편가입은 준비 중입니다.`);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">
          회원가입
        </h1>
        <p className="text-sm text-zinc-600">
          교육 수강을 위해 계정을 만들어 주세요.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
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
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-[var(--color-primary)] py-3 font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
        >
          {submitting ? "가입 중..." : "가입하기"}
        </button>
      </form>

      <Divider>또는</Divider>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleSocial("kakao")}
          className="rounded bg-[#FEE500] py-3 text-sm font-semibold text-[#3C1E1E] hover:brightness-95"
        >
          카카오로 가입
        </button>
        <button
          type="button"
          onClick={() => handleSocial("naver")}
          className="rounded bg-[#03C75A] py-3 text-sm font-semibold text-white hover:brightness-95"
        >
          네이버로 가입
        </button>
      </div>

      <p className="text-center text-sm text-zinc-600">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-semibold text-[var(--color-accent)] hover:underline">
          로그인
        </Link>
      </p>
    </div>
  );
}

const inputClass =
  "w-full rounded border border-[var(--color-border)] px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20";

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
      <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-800">
        {label}
      </label>
      {children}
    </div>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-xs text-zinc-500">
      <span className="h-px flex-1 bg-[var(--color-border)]" />
      {children}
      <span className="h-px flex-1 bg-[var(--color-border)]" />
    </div>
  );
}
