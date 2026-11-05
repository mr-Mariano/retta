"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** ✕ for the desktop match panel; Esc does the same. */
export function ClosePanel({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") router.push(href, { scroll: false });
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [href, router]);

  return (
    <Link
      href={href}
      scroll={false}
      aria-label="Cerrar"
      className="flex size-9 shrink-0 items-center justify-center self-end rounded-full bg-elevated text-ink"
    >
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </Link>
  );
}
