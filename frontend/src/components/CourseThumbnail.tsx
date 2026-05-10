"use client";

import Image from "next/image";
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
  // 썸네일 중앙에 표시할 텍스트 (강의명) — 미지정 시 표시 안 함
  title?: string;
  // LCP 후보 (above-the-fold 카드): true 면 즉시 로드 + fetchPriority high
  eager?: boolean;
  // 외부에서 추가로 얹을 오버레이 (재생 버튼 등)
  children?: React.ReactNode;
}

/**
 * 강의 카드/상세에서 공통으로 사용하는 16:9 썸네일.
 * - thumbnailMap 에 정의된 카테고리는 /thumbnails/{slug}.png 사용
 * - 정의되지 않은 카테고리는 네이비 배경 + BookOpen 아이콘 fallback
 */
export function CourseThumbnail({ category, title, eager = false, children }: Props) {
  const slug = thumbnailMap[category];

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
        <Image
          src={`/thumbnails/${slug}.png`}
          alt={title ?? category}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          quality={80}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          style={{ objectFit: "cover" }}
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

      {/* 좌상단 무료 수강 뱃지 */}
      <span className="absolute top-2.5 left-3 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
        무료 수강
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
          width: 40,
          height: "auto",
          filter: "brightness(0) invert(1)",
          opacity: 0.8,
        }}
      />

      {/* 중앙 강의 제목 */}
      {title && (
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            maxWidth: "80%",
            textAlign: "center",
            color: "white",
            fontSize: "1.25rem",
            fontWeight: 700,
            lineHeight: 1.3,
            textShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          {title}
        </span>
      )}

      {children}
    </div>
  );
}
