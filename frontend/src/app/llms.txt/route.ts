import { ABOUT_PARAGRAPHS, ORG, SITE_URL, fetchApi } from "@/lib/seo";
import { CASE_LANDINGS } from "@/lib/caseLandings";

// AI 검색(ChatGPT·Claude·Perplexity 등)이 사이트를 빠르게 이해하도록 요약한 안내 파일
// (llmstxt.org 형식, 2026-10). 강의·가격은 API 에서 그때그때 읽어 실제 값과 어긋나지 않게 한다.
export const revalidate = 3600;

type Course = { id: number; title: string; price: number; category: string; is_active: boolean };
type Faq = { question: string; answer: string };

export async function GET() {
  const [courses, faqs] = await Promise.all([
    fetchApi<Course[]>("/courses", 3600),
    fetchApi<Faq[]>("/faq", 3600),
  ]);
  const lines: string[] = [
    `# ${ORG.name} (KCPEC)`,
    "",
    `> ${ABOUT_PARAGRAPHS[0]}`,
    "",
    ...ABOUT_PARAGRAPHS.slice(1),
    "",
    "## 주요 안내",
    `- [강의 전체보기](${SITE_URL}/courses): 사건 유형별 재범방지교육 과정과 가격`,
    `- [맞춤 강의 찾기](${SITE_URL}/sentencing): 사건 유형을 고르면 필요한 교육과 발급 서류를 안내`,
    `- [전문가 심리상담](${SITE_URL}/counseling): 공인 심리상담사의 심리상담 의견서(서면·전화)`,
    `- [구속수용자 교육](${SITE_URL}/detention): 수감 중인 분을 위한 우편 교육자료`,
    `- [이용 안내·환불 정책](${SITE_URL}/guide)`,
    `- [변호사 파트너](${SITE_URL}/partner)`,
    "",
    "## 사건 유형별 안내",
    ...CASE_LANDINGS.map((c) => `- [${c.name} 재범방지교육](${SITE_URL}/education/${c.slug})`),
  ];
  const active = (courses ?? []).filter((c) => c.is_active && c.category !== "심리상담");
  if (active.length) {
    lines.push("", "## 교육 과정 (수료 시 수료증·서약서 PDF 발급)");
    for (const c of active) {
      lines.push(`- [${c.title}](${SITE_URL}/courses/${c.id}): ${c.price.toLocaleString("ko-KR")}원`);
    }
  }
  if (faqs?.length) {
    lines.push("", "## 자주 묻는 질문");
    for (const f of faqs) {
      lines.push(`### ${f.question}`, f.answer.trim(), "");
    }
  }
  lines.push(
    "",
    "## 회사 정보",
    `- 상호: ${ORG.legalName} / 대표: ${ORG.founder}`,
    `- 사업자등록번호: ${ORG.taxID}`,
    `- 주소: 서울 강남구 ${ORG.address.streetAddress}`,
    `- 문의: 010-6377-3325 / ${ORG.email}`,
  );
  return new Response(lines.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
