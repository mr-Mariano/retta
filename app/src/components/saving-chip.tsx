"use client";

import { useEffect, useState } from "react";

export type SaveState = "idle" | "saving" | "saved";

/**
 * Small "Guardando… / Guardado" chip for changes that show on screen at once
 * (waiting feedback C, 2026-11-04). "Guardado" fades out after a moment.
 */
export function SavingChip({ state }: { state: SaveState }) {
  const [visible, setVisible] = useState(state);
  useEffect(() => {
    setVisible(state);
    if (state !== "saved") return;
    const timer = window.setTimeout(() => setVisible("idle"), 1800);
    return () => window.clearTimeout(timer);
  }, [state]);

  if (visible === "idle") return null;
  return (
    <span role="status" className="inline-flex animate-fade-in items-center gap-1.5 rounded-[6px] bg-elevated px-3 py-1 text-[13px] font-semibold text-muted">
      {visible === "saving" ? (
        <>
          <span aria-hidden="true" className="saving-dot size-2 rounded-full bg-action" />
          Guardando…
        </>
      ) : (
        <>
          <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-ink">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          <span className="text-ink">Guardado</span>
        </>
      )}
    </span>
  );
}
