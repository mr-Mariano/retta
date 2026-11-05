"use client";

import { useState, useTransition } from "react";
import { SavingChip, type SaveState } from "@/components/saving-chip";
import { stopAgent } from "../actions";

/** Stops the agent at once and confirms in the background (waiting feedback C). */
export function StopAgentButton({ matchId, compact = false }: { matchId: string; compact?: boolean }) {
  const [state, setState] = useState<SaveState>("idle");
  const [, startTransition] = useTransition();

  function stop() {
    setState("saving");
    startTransition(async () => {
      await stopAgent(matchId);
      setState("saved");
    });
  }

  if (state !== "idle") {
    return (
      <span className={`flex items-center gap-2 ${compact ? "" : "mt-2 justify-center"}`}>
        {!compact && <span className="text-[15px] font-semibold text-muted">Agente detenido</span>}
        <SavingChip state={state} />
      </span>
    );
  }
  return compact ? (
    <button type="button" onClick={stop} className="text-[13px] font-semibold text-muted underline underline-offset-2">
      Apagar
    </button>
  ) : (
    <button
      type="button"
      onClick={stop}
      className="pending-button mt-2 flex h-11 w-full items-center justify-center rounded-[6px] border border-line text-[15px] font-semibold text-danger"
    >
      Detener agente
    </button>
  );
}
