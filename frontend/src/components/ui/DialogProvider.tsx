"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

type DialogTone = "default" | "danger";

type AlertOptions = {
  title?: string;
  confirmText?: string;
  tone?: DialogTone;
};

type ConfirmOptions = {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: DialogTone;
};

type DialogState =
  | {
      kind: "alert";
      message: string;
      title?: string;
      confirmText: string;
      tone: DialogTone;
      resolve: () => void;
    }
  | {
      kind: "confirm";
      message: string;
      title?: string;
      confirmText: string;
      cancelText: string;
      tone: DialogTone;
      resolve: (value: boolean) => void;
    };

type DialogContextValue = {
  // OK 버튼 하나뿐인 안내창 — 기존 window.alert() 대체.
  alert: (message: string, options?: AlertOptions) => Promise<void>;
  // 확인/취소 선택창 — 기존 window.confirm() 대체. true = 확인 선택.
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  // 여러 컴포넌트가 거의 동시에 alert()/confirm()을 호출하면 뒤 호출이
  // state를 통째로 덮어써서 앞 호출의 Promise(및 그걸 기다리던 await)가
  // 영원히 멈춰있던 문제가 있었다 — 큐로 바꿔 순서대로 하나씩 띄운다
  // (2026-09, 버그 감사 중 발견).
  const [queue, setQueue] = useState<DialogState[]>([]);
  const state = queue[0] ?? null;
  const dialogRef = useRef<HTMLDivElement>(null);

  function alert(message: string, options?: AlertOptions): Promise<void> {
    return new Promise((resolve) => {
      setQueue((q) => [
        ...q,
        {
          kind: "alert",
          message,
          title: options?.title,
          confirmText: options?.confirmText ?? "확인",
          tone: options?.tone ?? "default",
          resolve,
        },
      ]);
    });
  }

  function confirm(message: string, options?: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      setQueue((q) => [
        ...q,
        {
          kind: "confirm",
          message,
          title: options?.title,
          confirmText: options?.confirmText ?? "확인",
          cancelText: options?.cancelText ?? "취소",
          tone: options?.tone ?? "default",
          resolve,
        },
      ]);
    });
  }

  function handleClose(result: boolean) {
    if (!state) return;
    if (state.kind === "alert") state.resolve();
    else state.resolve(result);
    setQueue((q) => q.slice(1));
  }

  // Escape로 닫기(취소) + 포커스 트랩 — Tab이 다이얼로그 밖으로 빠져나가
  // 뒤에 깔린(시각적으로는 가려진) 페이지 요소로 이동하지 못하게 막는다.
  useEffect(() => {
    if (!state) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose(false);
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <DialogContext.Provider value={{ alert, confirm }}>
      {children}
      {state ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => handleClose(false)}
        >
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
          >
            {state.title ? (
              <h3 className="mb-2 text-lg font-extrabold text-slate-900">{state.title}</h3>
            ) : null}
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">
              {state.message}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              {state.kind === "confirm" ? (
                <button
                  type="button"
                  onClick={() => handleClose(false)}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {state.cancelText}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => handleClose(true)}
                autoFocus
                className={`rounded-full px-5 py-2 text-sm font-bold text-white transition-colors ${
                  state.tone === "danger"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]"
                }`}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DialogContext.Provider>
  );
}
