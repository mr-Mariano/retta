"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AvisosPopover, type PopoverInvite, type PopoverLine } from "./avisos-popover";

const ICONS = {
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
  avisos: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  saldo: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18M16 15h2" />
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

export interface SidebarItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: string;
  note?: string;
}

export interface UpcomingItem {
  href: string;
  title: string;
  when: string;
}

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Client half of the desktop sidebar: active section and the ⌘K shortcut. */
export function SidebarNav({
  avisos,
  items,
  upcoming,
  name,
  roleLabel,
  searchHref,
}: {
  avisos: { unread: number; invite: PopoverInvite | null; lines: PopoverLine[] };
  items: SidebarItem[];
  upcoming: UpcomingItem[];
  name: string;
  roleLabel: string;
  searchHref: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // ⌘K / Ctrl+K focuses the search box, opening Explorar if it isn't on screen.
  useEffect(() => {
    if (!searchHref) return;
    const href = searchHref;
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const input = document.getElementById("buscar") as HTMLInputElement | null;
        if (input && input.offsetParent !== null) input.focus();
        else router.push(href);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, searchHref]);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
  const onProfile = isActive(pathname, "/perfil");

  return (
    <aside aria-label="Menú" className="desktop-sidebar flex-col gap-1 border-r border-line bg-sidebar px-2.5 py-3.5">
      <Link href={items[0]!.href} className="flex h-10 items-center px-2.5 font-display text-[24px] font-bold tracking-tight">
        Retta
      </Link>
      {searchHref && (
        <Link href={searchHref} className="mt-1.5 mb-2.5 flex h-10 items-center gap-2.5 rounded-xl border border-line px-3 text-[15px] font-semibold">
          <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          Buscar retas
          <kbd className="ml-auto font-sans text-xs text-muted">⌘K</kbd>
        </Link>
      )}
      <nav aria-label="Secciones" className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          if (item.icon === "avisos") {
            return (
              <AvisosPopover
                key={item.href}
                active={active}
                unread={avisos.unread}
                invite={avisos.invite}
                lines={avisos.lines}
                icon={
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {ICONS.avisos}
                  </svg>
                }
              />
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-[38px] items-center gap-2.5 rounded-[6px] px-2.5 text-[15px] ${
                active ? "bg-elevated font-semibold text-ink" : "font-medium text-ink/80 hover:bg-elevated/60"
              }`}
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[item.icon]}
              </svg>
              <span className="flex-1">{item.label}</span>
              {item.badge && <span className="text-xs font-bold text-action">{item.badge}</span>}
              {item.note && <span className="text-xs font-semibold text-muted">{item.note}</span>}
            </Link>
          );
        })}
      </nav>
      {upcoming.length > 0 && (
        <>
          <span className="mx-2.5 mt-[18px] mb-1 text-xs font-semibold tracking-[0.06em] text-muted uppercase">Tus próximas</span>
          <ul className="flex flex-col">
            {upcoming.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex justify-between gap-2 rounded-[6px] px-2.5 py-[7px] text-sm ${active ? "bg-elevated text-ink" : "text-ink/80 hover:bg-elevated/60"}`}
                  >
                    <span className="truncate">{item.title}</span>
                    <span className="shrink-0 text-muted">{item.when}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <Link
        href="/perfil"
        aria-current={onProfile ? "page" : undefined}
        className={`mt-auto flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${onProfile ? "bg-elevated" : "hover:bg-elevated/60"}`}
      >
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#2B3A66] text-[13px] font-semibold text-white">
          {initials}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">{name}</span>
          <span className="text-xs text-muted">{roleLabel}</span>
        </span>
      </Link>
    </aside>
  );
}
