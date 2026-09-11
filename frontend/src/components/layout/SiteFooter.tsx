import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

// 예전엔 메인(홈) 페이지 안에만 있어서, 홈을 거치지 않고 링크로 바로
// 들어온 다른 페이지(강의/상담/마이페이지 등)에는 회사 정보·이용약관·
// 개인정보처리방침 링크가 전혀 없었다 — (main) 레이아웃으로 옮겨 전체
// 페이지에 공통 노출되도록 함(2026-09).
export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-[var(--color-primary)] pt-16 text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 md:px-6 pb-12 md:grid-cols-12">
        <div className="space-y-6 md:col-span-5 lg:col-span-4">
          <Logo variant="white" />
          <p className="text-sm leading-relaxed text-slate-400">
            국내 최다 범죄예방 교육과정 보유, 범죄관련 심리상담 전문 기관.
            공공기관(경찰, 검찰, 법원 등)에 제출 가능한 가장 확실하고
            신뢰할 수 있는 양형 자료를 제공합니다.
          </p>
        </div>

        <div className="md:col-span-7 lg:col-span-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div className="space-y-4">
            <h4 className="font-sans text-lg font-bold text-white">고객지원</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li>
                <span className="block text-slate-500 mb-1">상담문의</span>
                <a href="tel:01063773325" className="font-medium text-white hover:text-[var(--color-accent)] transition-colors">
                  010-6377-3325
                </a>
              </li>
              <li>
                <span className="block text-slate-500 mb-1">이메일</span>
                <a href="mailto:admin@kcpec.co.kr" className="font-medium text-white hover:text-[var(--color-accent)] transition-colors">
                  admin@kcpec.co.kr
                </a>
              </li>
              <li>
                <span className="block text-slate-500 mb-1">무통장 입금 계좌</span>
                <span className="text-white">기업은행 232-160450-04-015</span>
                <br />
                <span className="text-slate-500 text-xs">(예금주: 한국범죄예방교육센터)</span>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-sans text-lg font-bold text-white">회사 정보</h4>
            <ul className="space-y-2 text-sm text-slate-400 leading-relaxed">
              <li><strong className="text-slate-300">상호:</strong> 주식회사 한국범죄예방교육센터</li>
              <li><strong className="text-slate-300">대표:</strong> 윤승진</li>
              <li><strong className="text-slate-300">주소:</strong> 서울 강남구 언주로147길 42, 2층 2602호(논현동)</li>
              <li><strong className="text-slate-300">사업자등록번호:</strong> 495-86-03325</li>
              <li><strong className="text-slate-300">통신판매업신고:</strong> 제2024-서울강남-02655호</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-black/20">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 md:px-6 py-6 sm:flex-row">
          <p className="text-sm text-slate-500">
            ⓒ 2024 한국범죄예방교육센터. All rights reserved.
          </p>
          <div className="flex gap-4 text-sm text-slate-500">
            <Link href="/terms" className="hover:text-white transition-colors">이용약관</Link>
            <Link href="/privacy" className="hover:text-white transition-colors font-medium">개인정보처리방침</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
