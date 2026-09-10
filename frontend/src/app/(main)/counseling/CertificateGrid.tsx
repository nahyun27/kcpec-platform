"use client";

import Image from "next/image";
import { useState } from "react";

type Certificate = { slug: string; title: string; issuer: string };

// 예전엔 클릭하면 PDF 원본으로 이동해 다운로드까지 가능했는데, 굳이
// 다운로드까지 허용할 필요는 없고 크게 볼 수 있으면 충분하다는 요청으로
// 클릭 시 확대 모달만 띄우도록 변경.
export default function CertificateGrid({ certificates }: { certificates: Certificate[] }) {
  const [selected, setSelected] = useState<Certificate | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {certificates.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => setSelected(c)}
            title={`${c.title} 크게 보기`}
            className="group relative flex flex-col items-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--color-primary)]/30 hover:shadow-xl hover:shadow-slate-200/60"
          >
            <div className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] transition-transform duration-300 group-hover:scale-x-100" />
            <div className="relative mb-4 h-24 w-20 overflow-hidden rounded-lg shadow-md ring-1 ring-slate-900/5">
              <Image
                src={`/certs/${c.slug}.jpg`}
                alt={`${c.title} 자격증`}
                fill
                sizes="80px"
                quality={80}
                className="object-cover transition-transform duration-300 group-hover:scale-110"
              />
            </div>
            <p className="font-sans text-[13px] font-extrabold leading-tight text-slate-900">
              {c.title}
            </p>
            <p className="mt-1.5 text-[11px] font-medium text-slate-400">{c.issuer}</p>
          </button>
        ))}
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[95vw] sm:max-w-md overflow-hidden rounded-3xl bg-white p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[3/4] w-full max-h-[75vh]">
              <Image
                src={`/certs/${selected.slug}.jpg`}
                alt={`${selected.title} 자격증`}
                fill
                sizes="90vw"
                className="rounded-2xl object-contain"
              />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 mt-2">
              <span className="text-sm font-bold text-slate-800">{selected.title}</span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
