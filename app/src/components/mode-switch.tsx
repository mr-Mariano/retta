"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { MODE_COOKIE, modeFor, organizeHome, type Mode } from "@/lib/mode";

// One store for the sidebar, the bottom nav and the switches on the page.
let chosen: Mode | null = null;
const listeners = new Set<() => void>();

function choose(mode: Mode) {
  if (chosen === mode) return;
  chosen = mode;
  document.cookie = `${MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current mode: the page's own mode, otherwise the last one chosen. */
export function useMode(initial: Mode): Mode {
  const pathname = usePathname();
  const current = useSyncExternalStore(subscribe, () => chosen ?? initial, () => initial);
  const mode = modeFor(pathname, current);
  useEffect(() => {
    if (chosen === null) chosen = initial;
    choose(mode);
  }, [mode, initial]);
  return mode;
}

/** Jugar / Organizar (organizer mode B): changes the whole nav and opens that mode's home. */
export function ModeSwitch({ role, initial, className = "" }: { role: "player" | "field_manager"; initial: Mode; className?: string }) {
  const mode = useMode(initial);
  const router = useRouter();
  const go = (next: Mode) => {
    if (next === mode) return;
    choose(next);
    router.push(next === "jugar" ? "/explorar" : organizeHome(role));
  };

  return (
    <div role="group" aria-label="Modo" className={`flex rounded-[6px] bg-surface p-[3px] ${className}`}>
      {(["jugar", "organizar"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => go(option)}
          aria-pressed={mode === option}
          className={`h-[34px] flex-1 rounded-[4px] text-sm font-bold ${mode === option ? "bg-action text-on-action" : "text-muted hover:text-ink"}`}
        >
          {option === "jugar" ? "Jugar" : "Organizar"}
        </button>
      ))}
    </div>
  );
}
