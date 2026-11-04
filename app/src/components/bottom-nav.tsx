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
  inicio: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  canchas: (
    <>
      <path d="M3 21h18M5 21V8l7-5 7 5v13" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  usuarios: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 11a3 3 0 1 0 0-6M21 20a6 6 0 0 0-4-5.7" />
    </>
  ),
  retas: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M12 5v14" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
};

const PLAYER_SECTIONS = [
  { href: "/explorar", label: "Explorar", icon: ICON_PATHS.explorar },
  { href: "/mis-retas", label: "Mis retas", icon: ICON_PATHS.misRetas },
  { href: "/saldo", label: "Saldo", icon: ICON_PATHS.saldo },
  { href: "/perfil", label: "Perfil", icon: ICON_PATHS.perfil },
];

/** Admins get their own nav (option N1); their matches and balance open from Perfil. */
const ADMIN_SECTIONS = [
  { href: "/admin", label: "Inicio", icon: ICON_PATHS.inicio },
  { href: "/admin/canchas", label: "Canchas", icon: ICON_PATHS.canchas },
  { href: "/admin/usuarios", label: "Usuarios", icon: ICON_PATHS.usuarios },
  { href: "/admin/retas", label: "Retas", icon: ICON_PATHS.retas },
  { href: "/perfil", label: "Perfil", icon: ICON_PATHS.perfil },
];

const PLAYER_PATHS = PLAYER_SECTIONS.map((section) => section.href);
const ADMIN_PATHS = ADMIN_SECTIONS.map((section) => section.href);
let lastPaths = PLAYER_PATHS;

/** The section a path belongs to: exact match first, then the longest prefix. */
function sectionOf(paths: string[], pathname: string) {
  if (paths.includes(pathname)) return paths.indexOf(pathname);
  let best = -1;
  paths.forEach((path, i) => {
    if (pathname.startsWith(`${path}/`) && (best < 0 || path.length > paths[best]!.length)) best = i;
  });
  return best;
}

/** Position of `pathname` in the nav it belongs to, for the slide direction between tabs. */
export function tabIndex(pathname: string) {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) lastPaths = ADMIN_PATHS;
  else if (sectionOf(PLAYER_PATHS, pathname) >= 0 && pathname !== "/perfil" && !pathname.startsWith("/perfil/")) lastPaths = PLAYER_PATHS;
  return sectionOf(lastPaths, pathname);
}

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

/** Floating nav (session 4): the active section expands into a labeled pill. */
export function BottomNav({ admin = false }: { admin?: boolean }) {
  const pathname = usePathname();
  const hidden = useHideOnScrollDown();
  const sections = admin ? ADMIN_SECTIONS : PLAYER_SECTIONS;
  const active = sectionOf(sections.map((section) => section.href), pathname);

  return (
    <nav
      aria-label={admin ? "Navegación de administración" : "Navegación principal"}
      className={`fixed inset-x-4 bottom-6 z-10 mx-auto flex h-12 ${admin ? "max-w-[340px]" : "max-w-[312px]"} items-center justify-between rounded-full border border-line bg-elevated p-1 transition-transform duration-300 motion-reduce:transition-none ${
        hidden ? "translate-y-[calc(100%+2rem)]" : ""
      }`}
    >
      {sections.map((section, i) => {
        const isActive = i === active;
        return (
          <Link
            key={section.href}
            href={section.href}
            prefetch
            aria-label={isActive ? undefined : section.label}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "flex h-10 items-center gap-2 rounded-full bg-action px-3.5 text-sm font-bold text-on-action"
                : "flex size-10 items-center justify-center text-muted"
            }
          >
            <svg
              aria-hidden="true"
              width={isActive ? 18 : 20}
              height={isActive ? 18 : 20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {section.icon}
            </svg>
            {isActive && section.label}
          </Link>
        );
      })}
    </nav>
  );
}
