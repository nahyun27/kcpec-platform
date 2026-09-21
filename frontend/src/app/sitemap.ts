import type { MetadataRoute } from "next";
import { CASE_LANDINGS } from "@/lib/caseLandings";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

async function fetchCourseIds(): Promise<number[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/courses`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const courses: { id: number }[] = await res.json();
    return courses.map((c) => c.id);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/courses`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/counseling`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/sentencing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/community`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/guide`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const courseIds = await fetchCourseIds();
  const courseRoutes: MetadataRoute.Sitemap = courseIds.map((id) => ({
    url: `${SITE_URL}/courses/${id}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const landingRoutes: MetadataRoute.Sitemap = CASE_LANDINGS.map((c) => ({
    url: `${SITE_URL}/education/${c.slug}`,
    changeFrequency: "monthly",
    priority: 0.9,
  }));

  return [...staticRoutes, ...landingRoutes, ...courseRoutes];
}
