import { notFound } from "next/navigation";
import CategoryDetailClient from "./_client";
import {
  isNoticeCategory,
  isPostCategory,
  type NoticeCategory,
  type PostCategory,
} from "@/types/community";

export default async function Page({
  params,
}: {
  params: Promise<{ category: string; id: string }>;
}) {
  const { category, id } = await params;
  if (!isNoticeCategory(category) && !isPostCategory(category)) notFound();
  const numId = Number(id);
  if (!Number.isFinite(numId)) notFound();
  return (
    <CategoryDetailClient
      category={category as NoticeCategory | PostCategory}
      id={numId}
    />
  );
}
