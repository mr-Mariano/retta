"use client";

import { useState, useTransition } from "react";
import { SavingChip, type SaveState } from "@/components/saving-chip";
import { markAttendance } from "../../actions";

interface Player {
  id: string;
  name: string;
  attendance: "unrecorded" | "present" | "absent";
}

/** "Vino / No vino" per player; each tap saves right away (session 2: metrics only). */
export function AttendanceList({ players }: { players: Player[] }) {
  const [marks, setMarks] = useState(() => new Map(players.map((p) => [p.id, p.attendance])));
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [, startTransition] = useTransition();
  const marked = [...marks.values()].filter((value) => value !== "unrecorded").length;

  function mark(id: string, value: "present" | "absent") {
    const previous = marks.get(id)!;
    setMarks((current) => new Map(current).set(id, value));
    setError(null);
    setSaveState("saving");
    startTransition(async () => {
      const result = await markAttendance(id, value);
      if (result.error) {
        setMarks((current) => new Map(current).set(id, previous));
        setError(result.error);
        setSaveState("idle");
      } else {
        setSaveState("saved");
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-[6px] border border-line bg-surface px-3.5 py-3">
        <span aria-live="polite" className="text-[15px]">
          <span className="font-semibold">
            {marked} de {players.length}
          </span>
          <span className="text-muted"> marcados</span>
        </span>
        <SavingChip state={saveState} />
      </div>
      {error && <p className="text-[13px] text-danger">{error}</p>}
      <ul className="flex flex-col divide-y divide-line">
        {players.map((player) => {
          const value = marks.get(player.id);
          return (
            <li key={player.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{player.name}</span>
              <div role="group" aria-label={`Asistencia de ${player.name}`} className="flex rounded-xl border border-line bg-surface p-[3px]">
                <button
                  type="button"
                  onClick={() => mark(player.id, "present")}
                  aria-pressed={value === "present"}
                  className={`h-[34px] rounded-[6px] px-3 text-sm font-semibold ${value === "present" ? "bg-action text-on-action" : "text-muted"}`}
                >
                  Vino
                </button>
                <button
                  type="button"
                  onClick={() => mark(player.id, "absent")}
                  aria-pressed={value === "absent"}
                  className={`h-[34px] rounded-[6px] px-3 text-sm font-semibold ${value === "absent" ? "bg-elevated text-ink" : "text-muted"}`}
                >
                  No vino
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
