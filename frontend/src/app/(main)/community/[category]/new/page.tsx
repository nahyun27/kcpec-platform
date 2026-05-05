import { notFound } from "next/navigation";
import NewPostClient from "./_client";
import { isPostCategory, type PostCategory } from "@/types/community";

export default async function Page({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  // notice/resource 등은 관리자 전용 — 글쓰기 진입 차단
  if (!isPostCategory(category) || category === "column") notFound();
  return <NewPostClient category={category as PostCategory} />;
}
