"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Thin bar on top while the next screen loads (waiting feedback B,
 * 2026-11-04). It starts on any tap on an internal link and finishes when
 * the URL changes; the loading.tsx skeletons fill the page meanwhile.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setState("loading");
    }
    // Capture phase: next/link calls preventDefault before a bubbling listener would run.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    setState((current) => (current === "loading" ? "done" : current));
  }, [pathname, search]);

  // Fallback in case the fade's transitionend never fires.
  useEffect(() => {
    if (state !== "done") return;
    const timer = window.setTimeout(() => setState("idle"), 600);
    return () => window.clearTimeout(timer);
  }, [state]);

  if (state === "idle") return null;
  return (
    <div
      aria-hidden="true"
      data-state={state}
      className="nav-progress"
      onTransitionEnd={() => setState((current) => (current === "done" ? "idle" : current))}
    />
  );
}
