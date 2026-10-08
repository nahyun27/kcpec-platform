import { NextRequest, NextResponse } from "next/server";
import { LAWYER_REFERRAL_COOKIE } from "@/lib/cookies";

// 변호사 파트너 전용 단축 링크 — 변호사님이 의뢰인께 문자로 보내는 링크.
// 클릭하면 추천 코드를 쿠키에 저장해두고 맞춤 강의 찾기로 보낸다. 실제
// 코드가 유효한지(활성 파트너인지)는 여기서 확인하지 않는다 — 결제 화면의
// 기존 "추천 코드 확인" 로직이 그대로 검증하므로, 여기서는 그냥 저장만
// 하고 조용히 넘어간다(틀린 코드라도 페이지 이동 자체는 막지 않음).
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90일

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase().slice(0, 16);

  const url = new URL("/sentencing", req.url);
  const res = NextResponse.redirect(url);

  if (normalized) {
    res.cookies.set(LAWYER_REFERRAL_COOKIE, normalized, {
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
    });
  }
  return res;
}
