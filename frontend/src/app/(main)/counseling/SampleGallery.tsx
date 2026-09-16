"use client";

import { useState } from "react";

type Sample = { src: string; caption: string };

// 메인 페이지 수료증 샘플과 동일한 클릭 시 확대 모달 — 이 페이지 샘플은
// 원래 그냥 정적 이미지라 클릭해도 아무 반응이 없었다(2026-09 발견).
export default function SampleGallery({ samples }: { samples: Sample[] }) {
  const [selected, setSelected] = useState<Sample | null>(null);

  return (
    <>
      <div className="mx-auto mt-16 grid max-w-2xl grid-cols-2 gap-8 text-center">
        {samples.map((s) => (
          <div key={s.src}>
            <p className="mb-4 text-sm font-bold text-slate-500">{s.caption}</p>
            <button
              type="button"
              onClick={() => setSelected(s)}
              title={`${s.caption} 크게 보기`}
              className="block w-full cursor-pointer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.src}
                alt={s.caption}
                className="aspect-[3/4] w-full rounded-2xl border border-zinc-200 object-cover shadow-sm transition-transform hover:scale-[1.02]"
              />
            </button>
          </div>
        ))}
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[95vw] overflow-hidden rounded-3xl bg-white p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.src}
              alt={selected.caption}
              className="max-h-[70vh] w-auto rounded-2xl object-contain mx-auto"
            />
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 mt-2">
              <span className="text-sm font-bold text-slate-800">{selected.caption}</span>
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
