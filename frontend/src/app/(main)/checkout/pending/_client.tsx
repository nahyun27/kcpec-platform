"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const BANK_ACCOUNT =
  process.env.NEXT_PUBLIC_BANK_ACCOUNT ??
  "국민은행 123-456-789012 (예금주: 한국범죄예방교육센터)";

export default function CheckoutPendingPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const bundleId = searchParams.get("bundle_id");
  const counseling = searchParams.get("counseling");

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-lg border border-[var(--color-border)] bg-white p-8 shadow-sm">
        <p className="text-center font-sans text-2xl font-bold text-[var(--color-primary)]">
          무통장 입금 안내
        </p>
        {bundleId ? (
          <p className="mt-2 text-center text-xs text-zinc-500">
            묶음 주문번호 #{bundleId} · 선택하신 강의 전체가 함께 확정됩니다.
          </p>
        ) : orderId ? (
          <p className="mt-2 text-center text-xs text-zinc-500">주문번호 #{orderId}</p>
        ) : null}

        <div className="mt-6 rounded border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-center">
          <p className="text-xs text-zinc-500">입금 계좌</p>
          <p className="mt-1 font-sans text-base font-semibold text-zinc-900">
            {BANK_ACCOUNT}
          </p>
        </div>

        <ul className="mt-6 space-y-2 text-sm text-zinc-700">
          <li>· 입금자명은 결제하신 본인 성함으로 부탁드립니다.</li>
          <li>· 영업일 기준 1일 이내 관리자가 확인 후 처리합니다.</li>
          <li>
            · 입금 확인이 완료되면 마이페이지에서 수료증을 발급하실 수 있습니다.
          </li>
        </ul>

        {counseling ? (
          <div className="mt-6 rounded border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="text-sm font-bold text-amber-800">
              심리상담 의견서는 이 주문에 포함되지 않았어요
            </p>
            <p className="mt-1 text-xs text-amber-700">
              선택하신 심리상담은 별도 결제가 필요합니다. 아래 버튼으로 이어서 신청해 주세요.
            </p>
            <Link
              href={`/counseling#${counseling}`}
              className="mt-3 inline-block rounded-full bg-amber-600 px-5 py-2 text-sm font-bold text-white hover:bg-amber-700"
            >
              심리상담 이어서 신청하기 →
            </Link>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-2">
          <Link
            href="/mypage"
            className="rounded bg-[var(--color-primary)] py-3 text-center font-semibold text-white hover:bg-[var(--color-primary-hover)]"
          >
            마이페이지로 이동
          </Link>
          <Link
            href="/courses"
            className="rounded border border-[var(--color-border)] py-3 text-center text-sm text-zinc-700 hover:border-[var(--color-primary)]"
          >
            강의 목록으로
          </Link>
        </div>
      </div>
    </div>
  );
}
