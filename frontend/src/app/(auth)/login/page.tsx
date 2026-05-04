"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
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
      router.push("/");
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      setError(detail ?? "로그인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSocial(provider: "kakao" | "naver") {
    // TODO: NextAuth signIn(provider) 활성화 후 연결
    alert(`${provider === "kakao" ? "카카오" : "네이버"} 로그인은 준비 중입니다.`);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">
          로그인
        </h1>
        <p className="text-sm text-zinc-600">
          가입하신 아이디와 비밀번호를 입력해 주세요.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label htmlFor="username" className="block text-sm font-medium text-zinc-800">
            아이디
          </label>
          <input
            id="username"
            type="text"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-zinc-800">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>

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
          {submitting ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        간편 로그인
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleSocial("kakao")}
          className="rounded bg-[#FEE500] py-3 text-sm font-semibold text-[#3C1E1E] hover:brightness-95"
        >
          카카오 로그인
        </button>
        <button
          type="button"
          onClick={() => handleSocial("naver")}
          className="rounded bg-[#03C75A] py-3 text-sm font-semibold text-white hover:brightness-95"
        >
          네이버 로그인
        </button>
      </div>

      <p className="text-center text-sm text-zinc-600">
        아직 계정이 없으신가요?{" "}
        <Link href="/signup" className="font-semibold text-[var(--color-accent)] hover:underline">
          회원가입
        </Link>
      </p>
    </div>
  );
}

const inputClass =
  "w-full rounded border border-[var(--color-border)] px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20";
