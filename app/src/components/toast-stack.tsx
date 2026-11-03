"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

const DURATION_MS = 5000;
const MAX_VISIBLE = 3;

export interface Toast {
  id: string;
  message: ReactNode;
}

/**
 * Toasts stack open, newest at the bottom, up to 3 (session 7). Each closes by itself
 * after 5 s or with its own button. `clearParams` drops the URL params that produced
 * them so a reload doesn't show them again.
 */
export function ToastStack({ toasts, clearParams = [] }: { toasts: Toast[]; clearParams?: string[] }) {
  const [visible, setVisible] = useState(toasts);
  // Rewrite the URL without a server round trip, which would drop the toasts.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!clearParams.some((key) => url.searchParams.has(key))) return;
    clearParams.forEach((key) => url.searchParams.delete(key));
    window.history.replaceState(window.history.state, "", url);
  }, [clearParams]);

  const dismiss = useCallback((id: string) => setVisible((current) => current.filter((toast) => toast.id !== id)), []);
  const shown = visible.slice(-MAX_VISIBLE);
  if (shown.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-24 z-20 mx-auto flex max-w-[calc(28rem-2rem)] flex-col gap-2.5">
      {shown.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), DURATION_MS);
    return () => clearTimeout(timer);
  }, [onDismiss, toast.id]);

  return (
    <div
      role="status"
      className="pointer-events-auto relative flex h-[52px] animate-toast-in items-center gap-2.5 overflow-hidden rounded-2xl bg-ink pr-1 pl-3.5 text-[15px] font-semibold text-[var(--color-bg-base)] shadow-[0_12px_32px_rgb(0_0_0/0.45)]"
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" className="shrink-0">
        <circle cx="12" cy="12" r="10" className="fill-action" />
        <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="min-w-0 flex-1 truncate">{toast.message}</span>
      <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Cerrar aviso" className="flex size-11 shrink-0 items-center justify-center rounded-xl">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </button>
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--color-bg-base)]/15">
        <span className="block h-full origin-left animate-[toast-progress_5s_linear_forwards] bg-action" />
      </span>
    </div>
  );
}
