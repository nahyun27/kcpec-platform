import HomePage from "./_home";
import { JsonLd } from "@/components/seo/JsonLd";
import { faqPageLd, fetchApi } from "@/lib/seo";
import type { Faq } from "@/types/community";

// 홈은 화면 대부분이 클라이언트 컴포넌트(_home.tsx)라, 검색 로봇이 받는 원본에
// FAQ 답변과 구조화 데이터가 들어가도록 서버에서 미리 받아 넘긴다(2026-10).
export default async function Page() {
  const faqs = await fetchApi<Faq[]>("/faq");
  return (
    <>
      {faqs && faqs.length > 0 ? <JsonLd data={faqPageLd(faqs)} /> : null}
      <HomePage initialFaqs={faqs} />
    </>
  );
}
