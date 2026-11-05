"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Bell that opens Avisos: it rings and presses, the page behind recedes and
 * blurs, then Avisos grows from it (.avisos-reveal). Plain link without JS.
 */
export function BellLink({ unread }: { unread: number }) {
  const router = useRouter();
  const [ringing, setRinging] = useState(false);

  useEffect(() => {
    // Coming back from Avisos: undo the blur.
    delete document.documentElement.dataset.avisos;
  }, []);

  return (
    <Link
      href="/avisos"
      aria-label={unread > 0 ? `Avisos, ${unread} nuevos` : "Avisos"}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        event.preventDefault();
        setRinging(true);
        document.documentElement.dataset.avisos = "opening";
        window.setTimeout(() => router.push("/avisos"), 170);
      }}
      className={`relative flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink ${ringing ? "bell-ringing" : ""}`}
    >
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-[6px] border-2 border-base bg-action px-1 text-[11px] font-bold text-on-action">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
