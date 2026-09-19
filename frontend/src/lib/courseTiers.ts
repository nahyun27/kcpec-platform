// 강의 전체보기 탭 — 사건 유형(카테고리)이 아니라 상품 구성 기준으로 분류.
// (예전엔 가격대만으로 3단으로 나눴는데, 33,000원대 안에 "특수 상황용"과
// "단체·직장용" 강의가 섞여 있어 가격만으로는 구분이 안 됐다. 강의명 기준
// 화이트리스트로 4단 분류.)
// 순서: 기본 강의는 판매량이 높은 순, 나머지는 성격이 비슷한 것끼리 묶은
// 순서 — 의뢰인이 직접 지정(2026-09). "강의 전체보기"뿐 아니라 관리자
// 통계 페이지의 상품별 판매현황 뱃지에도 이 분류를 그대로 재사용한다
// (Course.category — 성범죄/폭력/재산범죄 등 — 는 강의 내용 주제 분류라
// 다른 목적이고, 여긴 상품 구성 기준 분류라 서로 다르다).
export const COURSE_TIERS = [
  {
    key: "basic",
    label: "기본 강의",
    titles: [
      "준법의식 강화",
      "음주운전 예방",
      "성범죄 예방",
      "성매매 예방",
      "디지털 성범죄 예방",
      "스토킹범죄 예방",
      "마약 예방",
      "도박 및 도박개장 예방",
      "피싱범죄 예방",
      "사기횡령배임 등 재산범죄 예방",
      "폭력범죄 예방교육",
      "명예훼손·모욕 예방 교육",
      "학교폭력 예방",
      "청소년범죄예방교육",
      "운전습관·도로교통법 교육",
    ],
  },
  {
    key: "behavior",
    label: "행동 교정강의",
    titles: [
      "생활예절교육",
      "분노 조절·감정 통제 교육",
      "알코올·중독 습관 교정 교육",
      "경제 관념·사행성 방지 교육",
    ],
  },
  {
    key: "special",
    label: "특수강의",
    titles: [
      "디지털 저작권·정보통신 윤리 교육",
      "개인정보 보호·사이버 금융 범죄 예방",
      "보호자 양육 윤리·예방 교육",
    ],
  },
  {
    key: "group",
    label: "단체강의",
    titles: [
      "공무원 윤리 교육",
      "비즈니스·직장 내 윤리 교육",
      "단체·학교 내 윤리 교육",
    ],
  },
] as const;

export function getTierLabel(title: string): string {
  return (
    COURSE_TIERS.find((t) => (t.titles as readonly string[]).includes(title))?.label ?? "기타"
  );
}

// 강의 전체보기 정렬 순서 — 탭(기본/행동교정/특수/단체) 순서대로, 탭 안에서는
// titles 배열에 적힌 순서대로.
export const TIER_SORT_INDEX = new Map<string, number>(
  COURSE_TIERS.flatMap((tier, tierIdx) =>
    tier.titles.map((title, i) => [title, tierIdx * 1000 + i] as const),
  ),
);
