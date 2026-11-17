// 상담 전용 토스 상점(kcpeca9706)은 BC카드 심사가 아직 진행 중이라(우리카드는 11-15 승인 확인)
// 두 카드로는 결제가 거절된다(2026-11-11 토스 안내, 2~3주 소요). 이 상점으로
// 가는 카드결제(심리상담 단독 신청)에만 안내한다. 묶음결제 카드는 승인 전까지
// 강의 상점으로 받으므로(backend core/toss.py COUNSELING_STORE_CARD_READY) 안내 없음.
// 승인 나면 false 로 끌 것.
export const COUNSELING_CARD_REVIEW_NOTICE = false; // 2026-11-17 BC 심사승인으로 끔
