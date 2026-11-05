"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Desktop ✕ on the match page (detail A, 2026-11-05): goes back to where the
 * person came from (Explorar, the chat, Mis retas), or to Explorar when the
 * page was opened directly. Esc does the same.
 */
export function CloseButton() {
  const router = useRouter();
  function close() {
    let inApp = false;
    try {
      inApp = sessionStorage.getItem("retta:in-app") === "1";
    } catch {}
    if (inApp && window.history.length > 1) router.back();
    else router.push("/explorar");
  }
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !document.querySelector('[role="dialog"]')) close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  return (
    <button
      type="button"
      onClick={close}
      aria-label="Cerrar"
      className="absolute top-5 left-0 hidden size-10 items-center justify-center rounded-[4px] text-ink hover:bg-surface lg:flex"
    >
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}
