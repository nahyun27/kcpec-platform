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

      {/* 다크 그라디언트 — 위는 살짝, 아래로 갈수록 진하게 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.4) 70%, rgba(0,0,0,0.65) 100%)",
        }}
      />

      {/* 우상단 KCPEC 워터마크 */}
      <span
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          color: "rgba(255,255,255,0.6)",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: 1,
        }}
      >
        KCPEC
      </span>

      {/* 하단 카테고리 레이블 */}
      <span
        style={{
          position: "absolute",
          bottom: 10,
          left: 12,
          color: "white",
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        {label}
      </span>

      {children}
    </div>
  );
}
