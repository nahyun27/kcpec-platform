"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { verifyEmail } from "@/lib/api";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export default function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  // 토큰이 아예 없는 경우는 최초 렌더 시점에 바로 알 수 있으니 effect 안에서
  // setState 하지 않고 초기값 자체를 "error" 로 잡는다.
  const [state, setState] = useState<"loading" | "done" | "error">(
    token ? "loading" : "error",
  );
  const [message, setMessage] = useState<string | null>(
    token ? null : "잘못된 접근입니다. (인증 링크 누락)",
  );
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current || !token) return;
    ranRef.current = true;
    verifyEmail(token)
      .then(() => setState("done"))
      .catch((err) => {
        const detail = isAxiosError(err)
          ? (err.response?.data as { detail?: string } | undefined)?.detail
          : null;
        setState("error");
        setMessage(detail ?? "이메일 인증에 실패했습니다.");
      });
    // 한 번만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full text-center lg:text-left">
      {state === "loading" ? (
        <>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--color-primary)] lg:mx-0" />
          <p className="mt-4 text-sm text-slate-500">이메일 인증 중입니다...</p>
        </>
      ) : state === "done" ? (
        <>
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 lg:mx-0">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="font-sans text-2xl font-extrabold tracking-tight text-slate-900">
            이메일 인증이 완료되었습니다
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            이제 발급 서류를 이 이메일 주소로 안전하게 받아보실 수 있습니다.
          </p>
        </>
      ) : (
        <>
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 lg:mx-0">
            <XCircle className="h-7 w-7" />
          </div>
          <h1 className="font-sans text-2xl font-extrabold tracking-tight text-slate-900">
            인증에 실패했습니다
          </h1>
          <p className="mt-3 text-sm text-slate-500">{message}</p>
        </>
      )}
      <Link
        href="/mypage"
        className="mt-8 inline-block font-bold text-[var(--color-primary)] hover:underline"
      >
        마이페이지로 이동
      </Link>
    </div>
  );
}
