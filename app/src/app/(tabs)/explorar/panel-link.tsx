"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

const DESKTOP = "(min-width: 1024px)";

/**
 * Link to a match. On phones it opens the match page; on desktop it opens the
 * match in the side panel over the results (option E, 2026-11-04).
 */
export function PanelLink({ matchId, className, children }: { matchId: string; className: string; children: ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <Link
      href={`/retas/${matchId}`}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || !window.matchMedia(DESKTOP).matches) return;
        event.preventDefault();
        const next = new URLSearchParams(params);
        next.set("reta", matchId);
        router.push(`/explorar?${next}`, { scroll: false });
      }}
    >
      {children}
    </Link>
  );
}
