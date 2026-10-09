"use client";

import { useState } from "react";

// 생년월일 입력 — 브라우저 기본 달력(type=date) 대신 숫자 8자리로 받는다.
// 휴대폰 달력은 오늘 날짜로 열려서 연도를 안 돌리고 그대로 확인을 누르는
// 경우가 많았다(2026-10, 수료증 6건이 발급일과 같은 2026년생으로 발급됨).
// 값은 부모에게 "YYYY-MM-DD"(완성·유효할 때만) 또는 "" 로만 넘긴다.

const MIN_AGE = 7;

function digitsOf(iso: string): string {
  return iso.replace(/\D/g, "").slice(0, 8);
}

function format(digits: string): string {
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export function ageOn(iso: string, today = new Date()): number {
  const [y, m, d] = iso.split("-").map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1;
  return age;
}

export function formatBirthKorean(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일생 (만 ${ageOn(iso)}세)`;
}

type Check = { iso: string; error: null } | { iso: ""; error: string | null };

function check(digits: string): Check {
  if (digits.length < 8) return { iso: "", error: null };
  const y = Number(digits.slice(0, 4));
  const m = Number(digits.slice(4, 6));
  const d = Number(digits.slice(6, 8));
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return { iso: "", error: "없는 날짜예요. 다시 확인해 주세요." };
  }
  if (y < 1900) return { iso: "", error: "연도를 다시 확인해 주세요." };
  const iso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  if (date > new Date()) return { iso: "", error: "오늘 이후 날짜는 입력할 수 없어요." };
  if (ageOn(iso) < MIN_AGE) {
    return { iso: "", error: `만 ${ageOn(iso)}세로 입력됐어요. 태어난 연도를 다시 확인해 주세요.` };
  }
  return { iso, error: null };
}

export function BirthDateInput({
  id,
  value,
  onChange,
  required,
  className,
  note,
}: {
  id?: string;
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
  className?: string;
  // 입력칸 아래 빨간 안내에 덧붙일 말 — 예: "수료증에 그대로 인쇄됩니다."
  note?: string;
}) {
  const [digits, setDigits] = useState(() => digitsOf(value));
  // 부모가 비동기로 값을 채우는 경우(수정 모드 등)만 따라간다 — 입력 도중
  // 아직 미완성이라 부모 값이 ""인 상태는 덮어쓰지 않는다.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (value && digitsOf(value) !== digits) setDigits(digitsOf(value));
  }

  const result = check(digits);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value.replace(/\D/g, "").slice(0, 8);
    setDigits(next);
    const r = check(next);
    e.target.setCustomValidity(
      next.length === 0 ? "" : r.error ?? (r.iso ? "" : "생년월일 8자리를 모두 입력해 주세요."),
    );
    if (r.iso !== value) onChange(r.iso);
  }

  const invalid = result.error !== null;

  return (
    <div>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder="예: 19900115"
        required={required}
        value={format(digits)}
        onChange={handleChange}
        aria-invalid={invalid}
        className={`${className ?? ""} ${invalid ? "!border-red-500 !ring-red-500/20" : ""}`}
      />
      <p className="mt-1.5 text-xs font-semibold text-red-600">
        {result.error
          ? result.error
          : result.iso
            ? `${formatBirthKorean(result.iso)}이 맞는지 다시 한 번 확인해 주세요.`
            : `숫자 8자리로 입력해 주세요 (예: 19900115).${note ? ` ${note}` : ""}`}
      </p>
    </div>
  );
}
