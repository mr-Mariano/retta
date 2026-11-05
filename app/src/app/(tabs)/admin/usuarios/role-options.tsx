"use client";

import { useState, useTransition } from "react";
import { FieldError } from "@/components/form";
import { SavingChip, type SaveState } from "@/components/saving-chip";
import { ROLE_LABELS } from "@/lib/role-labels";
import { setRole } from "@/app/admin/actions";

/** Tapping a role selects it at once and saves in the background (waiting feedback C). */
export function RoleOptions({ userId, role: initial }: { userId: string; role: string }) {
  const [role, setLocalRole] = useState(initial);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  function pick(next: string) {
    if (next === role) return;
    const previous = role;
    setLocalRole(next);
    setError("");
    setState("saving");
    startTransition(async () => {
      const result = await setRole(userId, next);
      if (result.error) {
        setLocalRole(previous);
        setError(result.error);
        setState("idle");
      } else {
        setState("saved");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Rol" className="flex flex-col gap-2">
        {Object.entries(ROLE_LABELS).map(([value, label]) => {
          const current = value === role;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={current}
              onClick={() => pick(value)}
              className={`pending-button flex h-[52px] w-full items-center justify-between rounded-2xl bg-elevated px-4 text-left text-[16px] font-semibold ${current ? "border-[1.5px] border-action" : "border border-line"}`}
            >
              {label}
              {current && (
                <span className="flex size-[22px] items-center justify-center rounded-full bg-action text-on-action">
                  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex min-h-7 justify-center">
        <SavingChip state={state} />
      </div>
      <FieldError id="rol-error">{error}</FieldError>
    </div>
  );
}
