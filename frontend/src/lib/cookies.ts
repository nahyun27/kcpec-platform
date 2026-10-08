// 변호사 추천 코드 등, 민감하지 않은 값을 짧게 기억해두는 용도의 가벼운
// 쿠키 유틸 — 로그인 세션(httpOnly, 서버 전용)과는 별개다.

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&")}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export const LAWYER_REFERRAL_COOKIE = "kcpec_lawyer_code";
