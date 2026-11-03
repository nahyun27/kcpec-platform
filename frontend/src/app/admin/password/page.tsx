"use client";

import { useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { updateMe } from "@/lib/api";

// 관리자 본인 비밀번호 변경(2026-11). 마이페이지 회원정보 수정과 같은 API 를 쓴다 —
// 관리자 메뉴에서 바로 찾을 수 있게 따로 둔 화면.
export default function AdminPasswordPage() {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (!currentPw) {
      setError("현재 비밀번호를 입력해 주세요.");
      return;
    }
    if (newPw.length < 8) {
      setError("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (newPw !== confirmPw) {
      setError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    setSubmitting(true);
    try {
      await updateMe({ current_password: currentPw, new_password: newPw });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setDone(true);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: unknown } | undefined)?.detail
        : null;
      setError(typeof detail === "string" ? detail : "비밀번호를 바꾸지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">비밀번호 변경</h1>
        <p className="mt-1 text-sm text-slate-500">
          지금 로그인한 관리자 계정의 비밀번호를 바꿉니다.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="max-w-md space-y-4 rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm"
      >
        <div className="space-y-1.5">
          <label htmlFor="current-pw" className="block text-sm font-medium text-slate-800">
            현재 비밀번호
          </label>
          <input
            id="current-pw"
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            autoComplete="current-password"
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="new-pw" className="block text-sm font-medium text-slate-800">
            새 비밀번호
          </label>
          <input
            id="new-pw"
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            autoComplete="new-password"
            placeholder="8자 이상"
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="confirm-pw" className="block text-sm font-medium text-slate-800">
            새 비밀번호 확인
          </label>
          <input
            id="confirm-pw"
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            autoComplete="new-password"
            className={inputCls}
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {done ? (
          <p className="text-sm font-semibold text-emerald-700">
            비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          {submitting ? "바꾸는 중..." : "비밀번호 바꾸기"}
        </button>
      </form>
    </div>
  );
}
