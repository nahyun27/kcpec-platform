import type { Metadata } from "next";
import CourseDetailPage from "./_client";

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
  const title = `${course.title} | KCPEC 교육 강의`;
  const description =
    course.description ??
    `${course.title} 온라인 교육 — 법원 제출용 수료증을 발급받을 수 있습니다.`;
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
  return <CourseDetailPage id={id} />;
}
