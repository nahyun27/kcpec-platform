import { redirect } from "next/navigation";

// FAQ 는 커뮤니티의 한 탭으로 통합됨. 기존 /faq 링크는 모두 리다이렉트.
export default function FaqRedirect(): never {
  redirect("/community?tab=faq");
}
