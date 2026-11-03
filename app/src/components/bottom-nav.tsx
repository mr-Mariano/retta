"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const ICON_PATHS = {
  explorar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  misRetas: (
    <>
      <path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" />
      <path d="M14 7v10" />
    </>
  ),
  saldo: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18M16 15h2" />
    </>
  ),
  perfil: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
};

export const TAB_PATHS = ["/explorar", "/mis-retas", "/saldo", "/perfil"];

const SECTIONS = [
  { href: "/explorar", label: "Explorar", icon: ICON_PATHS.explorar },
  { href: "/mis-retas", label: "Mis retas", icon: ICON_PATHS.misRetas },
  { href: "/saldo", label: "Saldo", icon: ICON_PATHS.saldo },
  { href: "/perfil", label: "Perfil", icon: ICON_PATHS.perfil },
];

// Scroll distance that counts as a direction change, so small jitters don't toggle the nav.
const SCROLL_THRESHOLD = 8;

/** Hidden while the page scrolls down, shown again on scroll up or near the top (session 7). */
function useHideOnScrollDown() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (Math.abs(delta) < SCROLL_THRESHOLD) return;
      setHidden(delta > 0 && y > 64);
      lastY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return hidden;
}

/** Floating player nav (session 4): the active section expands into a labeled pill. */
export function BottomNav() {
  const pathname = usePathname();
  const hidden = useHideOnScrollDown();

  return (
    <nav
      aria-label="Navegación principal"
      className={`fixed inset-x-4 bottom-6 z-10 mx-auto flex h-12 max-w-[312px] items-center justify-between rounded-full border border-line bg-elevated p-1 transition-transform duration-300 motion-reduce:transition-none ${
        hidden ? "translate-y-[calc(100%+2rem)]" : ""
      }`}
    >
      {SECTIONS.map((section) => {
        const active = pathname === section.href || pathname.startsWith(`${section.href}/`);
        return (
          <Link
            key={section.href}
            href={section.href}
            prefetch
            aria-label={active ? undefined : section.label}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "flex h-10 items-center gap-2 rounded-full bg-action px-3.5 text-sm font-bold text-on-action"
                : "flex size-10 items-center justify-center text-muted"
            }
          >
            <svg
              aria-hidden="true"
              width={active ? 18 : 20}
              height={active ? 18 : 20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {section.icon}
            </svg>
            {active && section.label}
          </Link>
        );
      })}
    </nav>
  );
}
