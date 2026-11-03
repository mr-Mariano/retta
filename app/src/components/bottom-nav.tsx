"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

const SECTIONS = [
  { href: "/explorar", label: "Explorar", icon: ICON_PATHS.explorar },
  { href: "/mis-retas", label: "Mis retas", icon: ICON_PATHS.misRetas },
  { href: "/saldo", label: "Saldo", icon: ICON_PATHS.saldo },
  { href: "/perfil", label: "Perfil", icon: ICON_PATHS.perfil },
];

/** Floating player nav (session 4): the active section expands into a labeled pill. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-4 bottom-6 z-10 mx-auto flex h-14 max-w-[358px] items-center justify-between rounded-full border border-line bg-elevated p-1"
    >
      {SECTIONS.map((section) => {
        const active = pathname === section.href || pathname.startsWith(`${section.href}/`);
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-label={active ? undefined : section.label}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "flex h-[46px] items-center gap-2 rounded-full bg-action px-4 text-[15px] font-bold text-on-action"
                : "flex size-[46px] items-center justify-center text-muted"
            }
          >
            <svg
              aria-hidden="true"
              width={active ? 20 : 22}
              height={active ? 20 : 22}
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
