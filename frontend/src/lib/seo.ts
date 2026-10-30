// 검색엔진·AI 검색용 공통 정보(2026-10). 서버 컴포넌트에서만 쓴다.
// 구조화 데이터(JSON-LD)와 llms.txt 가 같은 회사 정보·소개 문장을 쓰도록 한곳에 둔다.

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export const ORG = {
  name: "한국범죄예방교육센터",
  alternateName: ["KCPEC", "Korea Crime Prevention Education Center", "(주)한국범죄예방교육센터"],
  legalName: "(주)한국범죄예방교육센터",
  founder: "윤승진",
  telephone: "+82-10-6377-3325",
  email: "admin@kcpec.co.kr",
  taxID: "495-86-03325",
  address: {
    streetAddress: "언주로147길 42, 2층 2602호(논현동)",
    addressLocality: "강남구",
    addressRegion: "서울특별시",
    addressCountry: "KR",
  },
} as const;

import { ABOUT_PARAGRAPHS } from "./seoText";

export { ABOUT_PARAGRAPHS };

export const ORG_DESCRIPTION = ABOUT_PARAGRAPHS.join(" ");

export async function fetchApi<T>(path: string, revalidate = 600): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "@id": `${SITE_URL}/#organization`,
    name: ORG.name,
    alternateName: ORG.alternateName,
    legalName: ORG.legalName,
    url: SITE_URL,
    logo: `${SITE_URL}/images/logo-vertical.png`,
    description: ORG_DESCRIPTION,
    founder: { "@type": "Person", name: ORG.founder },
    telephone: ORG.telephone,
    email: ORG.email,
    taxID: ORG.taxID,
    address: { "@type": "PostalAddress", ...ORG.address },
    areaServed: "KR",
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: ORG.name,
    alternateName: "KCPEC",
    inLanguage: "ko-KR",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

// FAQ 답변은 관리자 입력 텍스트 그대로(줄바꿈만 공백으로).
export function faqPageLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer.replace(/\s+/g, " ").trim() },
    })),
  };
}

export function courseLd(course: {
  id: number;
  title: string;
  description: string | null;
  price: number;
  rating?: { average: number; count: number } | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: `${course.title} 재범방지교육`,
    description:
      course.description ??
      `${course.title} 재범방지교육 온라인 과정 — 수료 시 법원·검찰 제출용 수료증을 발급합니다.`,
    url: `${SITE_URL}/courses/${course.id}`,
    inLanguage: "ko-KR",
    provider: { "@id": `${SITE_URL}/#organization`, "@type": "Organization", name: ORG.name, sameAs: SITE_URL },
    offers: {
      "@type": "Offer",
      category: "Paid",
      price: course.price,
      priceCurrency: "KRW",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/courses/${course.id}`,
    },
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "Online",
    },
    ...(course.rating && course.rating.count >= 3
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: course.rating.average,
            reviewCount: course.rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}
