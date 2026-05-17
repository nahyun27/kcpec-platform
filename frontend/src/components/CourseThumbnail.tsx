"use client";

import Image from "next/image";
import { BookOpen } from "lucide-react";

// 강의 제목 → 썸네일 슬러그 (강의 1:1 매핑).
// 카테고리는 0015 마이그레이션에서 6개로 통합됐지만 강의 자체는
// 여전히 11개라 썸네일은 강의별로 유지한다.
const titleSlugMap: Record<string, string> = {
  "준법의식 강화": "compliance",
  "음주운전 예방": "driving",
  "성범죄 예방": "sex_crime",
  "성매매 예방": "prostitution",
  "디지털 성범죄 예방": "digital_crime",
  "마약 예방": "drug",
  "도박 및 도박개장 예방": "gambling",
  "피싱범죄 예방": "phishing",
  "사기횡령배임 등 재산범죄 예방": "property_crime",
  "스토킹범죄 예방": "stalking",
  "학교폭력 예방": "school_violence",
};

// 강의 제목이 사전에 없을 때(어드민이 새로 추가한 강의 등) 카테고리
// 기준으로 폴백할 대표 썸네일.
const categorySlugMap: Record<string, string> = {
  성범죄: "sex_crime",
  폭력: "school_violence",
  재산범죄: "property_crime",
  "약물·도박": "drug",
  교통: "driving",
  준법의식: "compliance",
};

interface Props {
  category: string;
  // 강의 제목 — 썸네일 슬러그 조회 + alt 텍스트에 사용
  title?: string;
  // 중앙에 title 을 오버레이로 표시할지 (강의 카드 ON, 상세 페이지 OFF)
  showTitle?: boolean;
  // LCP 후보 (above-the-fold 카드): true 면 즉시 로드 + fetchPriority high
  eager?: boolean;
  // 외부에서 추가로 얹을 오버레이 (재생 버튼 등)
  children?: React.ReactNode;
}

/**
 * 강의 카드/상세에서 공통으로 사용하는 16:9 썸네일.
 * - title 이 사전에 있으면 강의별 슬러그 사용 (1:1 매핑)
 * - 없으면 카테고리 대표 슬러그로 폴백
 * - 둘 다 없으면 네이비 배경 + BookOpen 아이콘 fallback
 */
export function CourseThumbnail({
  category,
  title,
  showTitle = false,
  eager = false,
  children,
}: Props) {
  const slug = (title && titleSlugMap[title]) ?? categorySlugMap[category];

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

      {/* 중앙 강의 제목 — showTitle 가 true 일 때만 노출 */}
      {showTitle && title && (
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
