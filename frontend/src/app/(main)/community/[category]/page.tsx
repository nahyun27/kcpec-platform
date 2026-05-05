import { notFound } from "next/navigation";
import CategoryListClient from "./_client";
import {
  isNoticeCategory,
  isPostCategory,
  type NoticeCategory,
  type PostCategory,
} from "@/types/community";

export default async function Page({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isNoticeCategory(category) && !isPostCategory(category)) notFound();
  return (
    <CategoryListClient
      category={category as NoticeCategory | PostCategory}
    />
  );
}
