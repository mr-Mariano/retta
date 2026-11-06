"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { dismissNotice, markAllRead } from "@/app/avisos/actions";
import { AgentMark } from "./agent-mark";

export interface PopoverInvite {
  id: string;
  href: string;
  cover: string;
  title: string;
  sub: string;
  closesIn: string | null;
}

export interface PopoverLine {
  id: string;
  icon: "check" | "coin" | "agent";
  text: string;
  when: string;
  href: string;
  unread: boolean;
}

/**
 * Desktop Avisos (E1, 2026-11-06): a small window next to the sidebar item.
 * The agent's invitation sits on top with Unirme / Ahora no; the rest are one
 * line each. Opening it marks everything read; "Ver todos" opens the inbox.
 */
export function AvisosPopover({
  active,
  unread,
  invite,
  lines,
  icon,
}: {
  active: boolean;
  unread: number;
  invite: PopoverInvite | null;
  lines: PopoverLine[];
  icon: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [count, setCount] = useState(unread);
  const [, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setCount(unread), [unread]);
  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && count > 0) {
      setCount(0);
      startTransition(() => markAllRead());
    }
  }

  const shownInvite = invite && !hidden.includes(invite.id) ? invite : null;
  const shownLines = lines.filter((line) => !hidden.includes(line.id) && (!onlyUnread || line.unread));

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex h-[38px] w-full items-center gap-2.5 rounded-[6px] px-2.5 text-[15px] ${
          active || open ? "bg-elevated font-semibold text-ink" : "font-medium text-ink/80 hover:bg-elevated/60"
        }`}
      >
        {icon}
        <span className="flex-1 text-left">Avisos</span>
        {count > 0 && <span className="text-xs font-bold text-action">{count}</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Avisos"
          className="absolute top-0 left-[calc(100%+14px)] z-40 w-[400px] animate-fade-in rounded-[8px] border border-line bg-surface shadow-[0_24px_60px_rgb(0_0_0/0.65)]"
        >
          <span aria-hidden="true" className="absolute top-3 -left-[7px] size-3 rotate-45 border-b border-l border-line bg-surface" />
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <span className="text-[17px] font-extrabold">Avisos</span>
            <span className="flex rounded-[6px] bg-base p-[3px]">
              {[
                ["Todos", false],
                [`Sin leer${unread ? ` · ${unread}` : ""}`, true],
              ].map(([label, value]) => (
                <button
                  key={String(label)}
                  type="button"
                  onClick={() => setOnlyUnread(value as boolean)}
                  className={`rounded-[4px] px-2.5 py-1 text-xs font-bold ${onlyUnread === value ? "bg-elevated text-ink" : "text-muted"}`}
                >
                  {label as string}
                </button>
              ))}
            </span>
          </div>

          {shownInvite && (
            <div className="mx-3 mb-2 overflow-hidden rounded-[6px] border border-line bg-base">
              <div className="relative h-24">
                <Image src={shownInvite.cover} alt="" fill sizes="376px" className="object-cover" />
                <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgb(0_0_0/0.75))]" />
                <span className="absolute bottom-2.5 left-3 flex items-center gap-2 text-xs font-bold text-white">
                  <AgentMark size={22} />
                  Te invita el agente
                </span>
                {shownInvite.closesIn && (
                  <span className="absolute top-2.5 right-2.5 rounded-[4px] bg-action px-2 py-0.5 text-[11px] font-bold text-on-action">
                    {shownInvite.closesIn}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2.5 p-3">
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-extrabold">{shownInvite.title}</span>
                  <span className="text-[13px] text-muted">{shownInvite.sub}</span>
                </span>
                <span className="flex gap-2">
                  <Link
                    href={shownInvite.href}
                    onClick={() => setOpen(false)}
                    className="flex h-9 flex-1 items-center justify-center rounded-[4px] bg-ink text-sm font-bold text-(--color-bg-base)"
                  >
                    Unirme
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setHidden((list) => [...list, shownInvite.id]);
                      startTransition(() => dismissNotice(shownInvite.id));
                    }}
                    className="h-9 rounded-[4px] border border-line px-3.5 text-sm font-semibold"
                  >
                    Ahora no
                  </button>
                </span>
              </div>
            </div>
          )}

          {shownLines.length === 0 && !shownInvite ? (
            <p className="px-4 pt-2 pb-5 text-sm text-muted">{onlyUnread ? "No tienes avisos sin leer." : "Todo al día. Aquí te avisamos cuando el agente te invite o se arme tu reta."}</p>
          ) : (
            <ul className="flex max-h-[260px] flex-col overflow-y-auto">
              {shownLines.map((line) => (
                <li key={line.id}>
                  <Link href={line.href} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-elevated/60">
                    <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${line.unread ? "bg-action" : ""}`} />
                    <LineIcon kind={line.icon} />
                    <span className={`flex-1 text-sm ${line.unread ? "font-semibold" : "text-ink/85"}`}>{line.text}</span>
                    <span className="text-xs text-muted">{line.when}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-between border-t border-line px-4 py-3 text-[13px] font-semibold text-muted">
            <span>{unread ? `${unread} sin leer` : "Al día"}</span>
            <Link href="/avisos" onClick={() => setOpen(false)} className="text-ink hover:underline">
              Ver todos →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function LineIcon({ kind }: { kind: PopoverLine["icon"] }) {
  if (kind === "agent") return <AgentMark size={26} />;
  return (
    <span aria-hidden="true" className={`flex size-[26px] shrink-0 items-center justify-center rounded-full ${kind === "check" ? "bg-action text-on-action" : "bg-elevated text-ink"}`}>
      {kind === "check" ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M9 9.5h4.5a2 2 0 0 1 0 4H10a2 2 0 0 0 0 4h5" />
        </svg>
      )}
    </span>
  );
}
