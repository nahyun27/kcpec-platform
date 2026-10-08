"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { applyLawyerPartner } from "@/lib/api";

export default function PartnerApplyForm() {
  const [lawFirmName, setLawFirmName] = useState("");
  const [lawyerName, setLawyerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    lawFirmName.trim() && lawyerName.trim() && email.trim() && phone.trim() && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await applyLawyerPartner({
        law_firm_name: lawFirmName.trim(),
        lawyer_name: lawyerName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      setDone(true);
    } catch {
      setError("신청에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        <p className="font-sans text-base font-bold text-emerald-800">신청이 접수되었습니다</p>
        <p className="text-sm text-emerald-700">
          확인 후 등록하신 이메일로 추천 코드와 전용 페이지 링크를 보내드립니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-left">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-slate-600">사무실명</label>
          <input
            type="text"
            value={lawFirmName}
            onChange={(e) => setLawFirmName(e.target.value)}
            placeholder="예) 법무법인 정의"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600">변호사 이름</label>
          <input
            type="text"
            value={lawyerName}
            onChange={(e) => setLawyerName(e.target.value)}
            placeholder="예) 홍길동"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600">이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="lawyer@firm.com"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600">연락처</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-0000-0000"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
      >
        {submitting ? "신청 중..." : "파트너 신청하기"}
      </button>
    </div>
  );
}
