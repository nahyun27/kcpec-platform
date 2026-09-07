"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { getSystemHealth } from "@/lib/api";
import type { HealthResponse } from "@/types/admin";

export default function AdminHealthPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setHealth(await getSystemHealth());
    } catch {
      setError("상태 점검을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">
            시스템 상태
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            배포 직후 조용히 깨져있기 쉬운 서버 의존성(PDF 변환, 한글 폰트, 영상
            저장소, 이메일 발송 등)을 한 번에 점검합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          다시 확인
        </button>
      </header>

      {error ? (
        <p className="py-20 text-center text-sm text-red-600">{error}</p>
      ) : loading && !health ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : health ? (
        <>
          <div
            className={`flex items-center gap-3 rounded-2xl border p-5 ${
              health.all_ok
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            {health.all_ok ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
            ) : (
              <XCircle className="h-6 w-6 shrink-0 text-red-600" />
            )}
            <div>
              <p
                className={`font-sans text-base font-bold ${
                  health.all_ok ? "text-emerald-800" : "text-red-800"
                }`}
              >
                {health.all_ok ? "전체 정상" : "확인이 필요한 항목이 있습니다"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                확인 시각: {new Date(health.checked_at).toLocaleString("ko-KR")}
              </p>
            </div>
          </div>

          <ul className="space-y-3">
            {health.items.map((item) => (
              <li
                key={item.name}
                className={`rounded-xl border p-4 ${
                  item.ok ? "border-zinc-200 bg-white" : "border-red-200 bg-red-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  {item.ok ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900">{item.name}</p>
                    {item.detail ? (
                      <p
                        className={`mt-1 text-sm leading-relaxed ${
                          item.ok ? "text-slate-500" : "text-red-700"
                        }`}
                      >
                        {item.detail}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
