import type { Metadata } from "next";
import CourseDetailPage from "./_client";
import { JsonLd } from "@/components/seo/JsonLd";
import { courseLd, fetchApi } from "@/lib/seo";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

async function fetchCourseForMetadata(
  id: string,
): Promise<{ title: string; description: string | null } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/courses/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const course = await fetchCourseForMetadata(id);
  if (!course) {
    return { title: "교육 강의 | KCPEC" };
  }
  const title = `${course.title} 재범방지교육 | KCPEC`;
  const description =
    course.description ??
    `${course.title} 재범방지교육 온라인 수강 — 법원·검찰 제출용 수료증(양형자료)을 발급받을 수 있습니다.`;
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 검색엔진용 강의 정보(이름·가격·별점) — 같은 요청은 Next 가 캐시해 위 메타데이터와 공유된다.
  const [course, summary] = await Promise.all([
    fetchApi<{ id: number; title: string; description: string | null; price: number }>(`/courses/${id}`, 3600),
    fetchApi<{ courses: { course_id: number; average: number; count: number }[] }>("/reviews/summary"),
  ]);
  const rating = summary?.courses.find((c) => c.course_id === course?.id) ?? null;
  return (
    <>
      {course ? <JsonLd data={courseLd({ ...course, rating })} /> : null}
      <CourseDetailPage id={id} />
    </>
  );
}
