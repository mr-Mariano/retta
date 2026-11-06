import type { SupabaseClient } from "@supabase/supabase-js";

/** A match as its organizer sees it (Tus retas, organizer home). */
export const ORGANIZED_SELECT =
  "id, title, status, min_players, max_players, confirmation_deadline, agent_enabled, slot:slots!inner(starts_at, ends_at, field:fields!inner(name)), registrations(count)";

export interface OrganizedRow {
  id: string;
  title: string | null;
  status: "pending" | "confirmed" | "cancelled";
  min_players: number;
  max_players: number;
  confirmation_deadline: string;
  agent_enabled: boolean;
  slot: { starts_at: string; ends_at: string; field: { name: string } };
  registrations: { count: number }[];
}

/** Status first (organizer card variant 4): what the organizer should know at a glance. */
export function describe(row: OrganizedRow, now: Date) {
  const startsAt = new Date(row.slot.starts_at);
  const active = row.registrations[0]?.count ?? 0;
  const minutes = Math.round((now.getTime() - startsAt.getTime()) / 60000);

  if (row.status === "cancelled")
    return { status: "Cancelada", accent: false, attendance: false };
  if (minutes >= 0) {
    const attendance = row.status === "confirmed" && minutes < 24 * 60;
    const status =
      row.status !== "confirmed"
        ? "No se armó"
        : minutes < 90
          ? `En juego · empezó hace ${minutes} min`
          : attendance
            ? "Terminó · pasa asistencia"
            : "Jugada";
    return { status, accent: attendance, attendance };
  }
  if (active === 0)
    return { status: "Sin inscritos aún", accent: false, attendance: false };
  if (active >= row.max_players)
    return { status: "Llena", accent: true, attendance: false };
  if (row.status === "pending") {
    const missing = row.min_players - active;
    return {
      status:
        missing === 1
          ? "Falta 1 para que se arme"
          : `Faltan ${missing} para que se arme`,
      accent: true,
      attendance: false,
    };
  }
  const left = row.max_players - active;
  return {
    status: `Ya se armó · ${left === 1 ? "queda 1 lugar" : `quedan ${left} lugares`}`,
    accent: true,
    attendance: false,
  };
}

interface RunRow {
  match_id: string;
  status: string;
  outcome: string | null;
  steps: { position: number; title: string; result: string | null; state: string }[];
}

/** What the agent is doing on each match, one short line per match (2026-11-06). */
export async function loadAgentNotes(supabase: SupabaseClient, list: OrganizedRow[], now: Date) {
  const { data: runs } = list.length
    ? await supabase
        .from("agent_runs")
        .select("match_id, status, outcome, steps:agent_steps(position, title, result, state)")
        .eq("kind", "rescue")
        .in("match_id", list.map((row) => row.id))
        .returns<RunRow[]>()
    : { data: [] as RunRow[] };
  return (row: OrganizedRow) => {
    const run = (runs ?? []).find((r) => r.match_id === row.id);
    if (run?.status === "running" && row.agent_enabled) {
      const step = run.steps.find((st) => st.state === "running");
      return { text: step?.result ?? step?.title ?? "Trabajando", working: true };
    }
    if (run?.outcome === "rescued") return { text: "La ayudó a armarse", working: false };
    if (run?.outcome === "not_rescued") return { text: "No se pudo salvar", working: false };
    if (run?.status === "stopped" || (!row.agent_enabled && row.status === "pending")) return { text: "Apagado", working: false };
    if (row.status === "pending" && new Date(row.slot.starts_at) > now) return { text: "Entra 1 h antes del cierre", working: false };
    return null;
  };
}
