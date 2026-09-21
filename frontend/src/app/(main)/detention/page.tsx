import { Suspense } from "react";
import DetentionClient from "./_client";
import DetentionIntro from "./_intro";

export const metadata = {
  title: "구속수용자 재범방지교육 (교육자료 우편 발송) | KCPEC",
  description:
    "구치소·교도소 수용 중인 분을 위한 재범방지교육. 보호자가 신청·결제하면 교육자료를 수용시설로 우편 발송하고, 교육 이수 후 수료증은 마이페이지에서 발급받으실 수 있습니다.",
};

export default function Page() {
  return (
    <div className="min-h-screen bg-slate-50">
      <DetentionIntro />
      <Suspense fallback={<p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>}>
        <DetentionClient />
      </Suspense>
    </div>
  );
}
