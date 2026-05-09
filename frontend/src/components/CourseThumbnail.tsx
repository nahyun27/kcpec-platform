"use client";

import { BookOpen } from "lucide-react";

const thumbnailMap: Record<string, string> = {
  준법: "compliance",
  음주: "driving",
  성범죄: "sex_crime",
  성매매: "prostitution",
  디지털성범죄: "digital_crime",
  마약: "drug",
  도박: "gambling",
  피싱: "phishing",
  재산범죄: "property_crime",
  스토킹: "stalking",
  학교폭력: "school_violence",
};

interface Props {
  category: string;
  // 하단 좌측 라벨 (기본값: category 그대로)
  categoryLabel?: string;
  // 외부에서 추가로 얹을 오버레이 (재생 버튼 등)
  children?: React.ReactNode;
}

/**
 * 강의 카드/상세에서 공통으로 사용하는 16:9 썸네일.
 * - thumbnailMap 에 정의된 카테고리는 /thumbnails/{slug}.png 사용
 * - 정의되지 않은 카테고리는 네이비 배경 + BookOpen 아이콘 fallback
 */
export function CourseThumbnail({ category, categoryLabel, children }: Props) {
  const slug = thumbnailMap[category];
  const label = categoryLabel ?? category;

  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "16 / 9",
        overflow: "hidden",
        borderRadius: 8,
        backgroundColor: "#1C3461",
      }}
    >
      {slug ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/thumbnails/${slug}.png`}
          alt={label}
          style={{
            objectFit: "cover",
            width: "100%",
            height: "100%",
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
          }}
        >
          <BookOpen size={48} color="#ffffff" strokeWidth={1.5} />
        </div>
      )}

      {/* 다크 그라디언트 — 위는 진하게, 아래는 살짝 (좌상단 뱃지 가독성) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.25) 100%)",
        }}
      />

      {/* 좌상단 카테고리 뱃지 */}
      <span className="absolute top-2.5 left-3 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
        {label}
      </span>

      {/* 우상단 KCPEC 로고마크 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo-mark.png"
        alt="KCPEC"
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          width: 28,
          height: "auto",
          filter: "brightness(0) invert(1)",
          opacity: 0.7,
        }}
      />

      {children}
    </div>
  );
}
