"use client";

import Image from "next/image";
import { useState } from "react";
import { createPortal } from "react-dom";

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

      {selected
        ? createPortal(
            // 카드 그리드가 Reveal(등장 애니메이션)로 감싸여 있는데, Reveal이
            // 항상 transform(translate-y-*)을 걸어둬서 그 안에 있으면 이
            // position:fixed 모달이 뷰포트가 아니라 Reveal 박스 기준으로
            // 잡혀 배경이 화면 전체가 아니라 좁게만 어두워졌다 — body로
            // 포털을 띄워 완전히 빠져나오게 한다(2026-09).
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
              onClick={() => setSelected(null)}
            >
              <div
                className="relative max-h-[90vh] max-w-[95vw] overflow-hidden rounded-3xl bg-white p-2 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/certs/${selected.slug}.jpg`}
                  alt={`${selected.title} 자격증`}
                  className="max-h-[70vh] w-auto rounded-2xl object-contain mx-auto"
                />
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
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
