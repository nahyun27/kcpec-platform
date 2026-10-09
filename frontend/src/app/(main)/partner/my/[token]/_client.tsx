"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, Scale } from "lucide-react";
import { getLawyerPartnerPortal, lawyerPartnerPortalQrUrl } from "@/lib/api";
import type { LawyerPartnerPortalInfo } from "@/types/order";

export default function LawyerPortalClient({ token }: { token: string }) {
  const [info, setInfo] = useState<LawyerPartnerPortalInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getLawyerPartnerPortal(token)
      .then(setInfo)
      .catch(() => setError("페이지를 찾을 수 없습니다. 링크를 다시 확인해 주세요."));
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <p className="text-sm text-zinc-500">{error}</p>
      </div>
    );
  }
  if (!info) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <p className="text-sm text-zinc-500">불러오는 중...</p>
      </div>
    );
  }

  const qrUrl = lawyerPartnerPortalQrUrl(token);
  const shortLink =
    (typeof window !== "undefined" ? window.location.origin : "") + `/r/${info.referral_code}`;
  const smsText = [
    `${info.law_firm_name} 안내드립니다.`,
    "재판에 제출할 재범방지교육 수료증과 반성문, 탄원서 등 양형자료를 온라인으로 준비하실 수 있습니다. 아래 링크로 들어가시면 10% 할인이 자동으로 적용되고, 수강을 마치는 즉시 수료증이 발급됩니다.",
    `바로가기: ${shortLink}\n코드: ${info.referral_code}`,
    "문의: 010-6377-3325 · admin@kcpec.co.kr",
    "한국범죄예방교육센터",
  ].join("\n\n");

  async function copySmsText() {
    try {
      await navigator.clipboard.writeText(smsText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 클립보드 차단 환경 — 조용히 무시 */
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50 px-6 py-12 md:py-16">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-white">
            <Scale className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-sans text-xl font-black text-slate-900 sm:text-2xl">
            {info.law_firm_name} {info.lawyer_name} 변호사님
          </h1>
          <p className="mt-1 text-sm text-slate-500">KCPEC 변호사 파트너 전용 페이지입니다.</p>
        </div>

        {info.status === "pending" ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            신청 승인 대기 중입니다. 승인이 완료되면 추천 코드가 결제 화면에서 바로
            동작합니다.
          </div>
        ) : info.status !== "active" ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            현재 비활성 상태입니다. 추천 코드가 결제 화면에서 동작하지 않습니다. 확인이
            필요하시면 010-6377-3325 · admin@kcpec.co.kr 로 문의해 주세요.
          </div>
        ) : null}

        <div className="rounded-3xl border-2 border-[var(--color-primary)] bg-white p-6 text-center shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]">
            나의 추천 코드
          </p>
          <p className="mt-2 font-mono text-3xl font-black tracking-wider text-slate-900 sm:text-4xl">
            {info.referral_code}
          </p>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt="추천 코드 QR"
            className="mx-auto mt-6 h-44 w-44 rounded-xl border border-zinc-200"
          />
          <a
            href={qrUrl}
            download={`kcpec-partner-qr-${info.referral_code}.png`}
            className="mt-3 inline-block text-xs font-semibold text-[var(--color-primary)] hover:underline"
          >
            QR 이미지 다운로드
          </a>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-700">
            <CheckCircle2 className="h-4 w-4 text-[var(--color-accent)]" />
            지금까지 {info.referral_order_count}건 소개해주셨습니다
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="font-sans text-sm font-bold text-slate-900">의뢰인께 보낼 문자</h2>
          <p className="mt-1 text-xs text-slate-500">
            아래 문자를 복사해서 그대로 보내주시기만 하면 됩니다. 의뢰인이 링크를 누르면 10%
            할인이 자동으로 적용된 수강 페이지가 열립니다. 코드를 따로 안내하실 필요는
            없습니다.
          </p>
          <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            {smsText}
          </pre>
          <button
            type="button"
            onClick={copySmsText}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-primary-hover)]"
          >
            <Copy className="h-4 w-4" />
            {copied ? "복사됨" : "문자 복사하기"}
          </button>
        </div>

        <p className="text-center text-xs text-zinc-400">
          이 페이지는 변호사님께만 전달되는 비공개 링크입니다. 외부에 공유하지 말아 주세요.
        </p>
      </div>
    </div>
  );
}
