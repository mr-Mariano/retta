"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect } from "react";

/**
 * Desktop (success A, 2026-11-06): instead of this full screen, go back to the
 * match, where the card says "¡Estás dentro!" and a toast confirms the payment.
 */
export function DesktopReturn({ href }: { href: string }) {
  const router = useRouter();
  useLayoutEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) router.replace(href, { scroll: false });
  }, [href, router]);
  return null;
}
