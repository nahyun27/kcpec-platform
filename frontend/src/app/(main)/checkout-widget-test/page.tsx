import { Suspense } from "react";
import CheckoutWidgetTestClient from "./_client";

// 결제위젯(인라인 임베드) 전환 검증용 임시 라우트 — 실제 /checkout 은 건드리지
// 않고 여기서만 따로 테스트한다. 검증 끝나면 이 라우트는 삭제한다(2026-09).
export default function Page() {
  return (
    <Suspense
      fallback={<p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>}
    >
      <CheckoutWidgetTestClient />
    </Suspense>
  );
}
