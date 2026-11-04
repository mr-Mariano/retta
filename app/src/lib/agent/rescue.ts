import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatTime } from "@/lib/time";
import { llmConfig, runToolLoop, type Tool } from "./llm";

/**
 * Rescue: a pending match whose confirmation deadline is less than an hour
 * away gets two passes. Pass 1 invites similar players and may extend the
 * deadline; pass 2, half an hour later, checks who joined and may invite more
 * or propose another slot to the organizer. The run ends when the match is
 * confirmed, cancelled or the organizer stops the agent.
 *
 * Each tool writes one fixed step of the task list the organizer sees.
 */

const WINDOW_MS = 60 * 60 * 1000;
const RECHECK_MS = 30 * 60 * 1000;
const MAX_INVITES = 10;

const STEP = { review: 1, search: 2, invite: 3, extend: 4, wait: 5, move: 6, end: 7 } as const;

interface MatchRow {
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

interface RunRow {
  id: string;
  match_id: string;
  passes: number;
  next_check_at: string | null;
  engine: string;
}

interface Candidate {
  id: string;
  full_name: string;
  same_field: number;
  same_hour: number;
  attended: number;
}

interface MoveOption {
  slot_id: string;
  field_name: string;
  starts_at: string;
  same_field: boolean;
  affinity: number;
}

const MATCH_SELECT =
  "id, title, status, min_players, max_players, confirmation_deadline, agent_enabled, slot:slots!inner(starts_at, ends_at, field:fields!inner(name)), registrations(count)";

export interface RescueSummary {
  started: string[];
  rechecked: string[];
  finished: string[];
}

export async function rescueTick(db: SupabaseClient, now: Date, force?: string): Promise<RescueSummary> {
  const summary: RescueSummary = { started: [], rechecked: [], finished: [] };
  summary.finished = await finishSettledRuns(db);

  const { data: runs } = await db
    .from("agent_runs")
    .select("id, match_id, passes, next_check_at, engine")
    .eq("kind", "rescue")
    .eq("status", "running")
    .returns<RunRow[]>();
  const runByMatch = new Map((runs ?? []).map((run) => [run.match_id, run]));

  // Matches entering the window, plus runs due for their second pass.
  const { data: pending } = await db
    .from("matches")
    .select(MATCH_SELECT)
    .eq("status", "pending")
    .eq("agent_enabled", true)
    .gt("confirmation_deadline", now.toISOString())
    .eq("registrations.status", "active")
    .returns<MatchRow[]>();

  for (const match of pending ?? []) {
    const deadline = new Date(match.confirmation_deadline).getTime();
    const run = runByMatch.get(match.id);
    const forced = match.id === force;
    if (!run) {
      const { count } = await db.from("agent_runs").select("id", { count: "exact", head: true }).eq("match_id", match.id);
      if ((count ?? 0) > 0) continue; // finished or stopped earlier
      if (forced || deadline - now.getTime() <= WINDOW_MS) {
        await firstPass(db, match, now);
        summary.started.push(match.id);
      }
    } else if (run.passes === 1 && (forced || (run.next_check_at && new Date(run.next_check_at) <= now))) {
      await secondPass(db, match, run);
      summary.rechecked.push(match.id);
    }
  }
  return summary;
}

/** Closes runs whose match is already confirmed or cancelled, or whose organizer stopped the agent. */
async function finishSettledRuns(db: SupabaseClient) {
  const { data: runs } = await db
    .from("agent_runs")
    .select(`id, match:matches!inner(${MATCH_SELECT})`)
    .eq("kind", "rescue")
    .eq("status", "running")
    .eq("match.registrations.status", "active")
    .returns<{ id: string; match: MatchRow }[]>();

  const finished: string[] = [];
  for (const { id, match } of runs ?? []) {
    const steps = new Steps(db, id);
    const active = match.registrations[0]?.count ?? 0;
    if (match.status === "confirmed") {
      const accepted = await acceptedCount(db, match.id);
      await steps.update(STEP.wait, `${accepted.accepted} de ${accepted.invited} aceptaron`);
      await steps.closeOpen("No hizo falta");
      await steps.set(STEP.end, "¡Se armó la reta!", `${active} de ${match.min_players}`, "done");
      await finish(db, id, "finished", "rescued");
    } else if (match.status === "cancelled") {
      await steps.closeOpen("No se completó");
      await steps.set(STEP.end, "No se juntó el mínimo", "Todos recibieron su saldo", "done");
      await finish(db, id, "finished", "not_rescued");
    } else if (!match.agent_enabled) {
      await steps.closeOpen("Detenido");
      await steps.set(STEP.end, "Detuviste al agente", null, "done");
      await finish(db, id, "stopped", null);
    } else {
      continue;
    }
    finished.push(match.id);
  }
  return finished;
}

async function finish(db: SupabaseClient, runId: string, status: "finished" | "stopped", outcome: string | null) {
  await db.from("agent_runs").update({ status, outcome, next_check_at: null, finished_at: new Date().toISOString() }).eq("id", runId);
}

async function firstPass(db: SupabaseClient, match: MatchRow, now: Date) {
  const { data: run, error } = await db
    .from("agent_runs")
    .insert({ kind: "rescue", match_id: match.id })
    .select("id")
    .single();
  if (error || !run) return; // another tick got here first

  const steps = new Steps(db, run.id);
  const active = match.registrations[0]?.count ?? 0;
  const missing = match.min_players - active;
  await steps.set(STEP.review, "Revisar la reta", `${active} de ${match.min_players} · faltan ${missing}`, "done");

  const tools = new RescueTools(db, match, steps, missing);
  const engine = await plan(
    tools,
    "primera",
    [tools.searchTool(), tools.inviteTool(), tools.extendTool(), terminate],
    async () => {
      const found = await tools.search(Math.min(missing * 3, MAX_INVITES));
      await tools.invite(found.slice(0, Math.min(missing * 2 + 1, MAX_INVITES)).map((c) => c.id));
      await tools.extend();
    },
  );

  const deadline = new Date(tools.deadline).getTime();
  const nextCheck = new Date(Math.min(now.getTime() + RECHECK_MS, deadline - 10 * 60 * 1000));
  await steps.set(STEP.wait, "Esperar respuestas", `Revisa otra vez a las ${formatTime(nextCheck)}`, "running");
  await steps.set(STEP.move, "Proponer otro horario", "Solo si no se llena", "queued");
  await db.from("agent_runs").update({ passes: 1, next_check_at: nextCheck.toISOString(), engine }).eq("id", run.id);
}

async function secondPass(db: SupabaseClient, match: MatchRow, run: RunRow) {
  const steps = new Steps(db, run.id);
  const active = match.registrations[0]?.count ?? 0;
  const missing = match.min_players - active;

  const { accepted, invited } = await acceptedCount(db, match.id);
  await steps.set(STEP.wait, "Esperar respuestas", `${accepted} de ${invited} aceptaron`, "done");

  const tools = new RescueTools(db, match, steps, missing, invited);
  await plan(
    tools,
    "segunda",
    [tools.searchTool(), tools.inviteTool(), tools.optionsTool(), tools.proposeTool(), terminate],
    async () => {
      const options = await tools.options();
      const best = options[0];
      if (best && best.affinity >= missing) {
        await tools.propose(best.slot_id, `Hay ${best.affinity} jugadores que suelen jugar en ${best.field_name}.`);
      } else {
        const found = await tools.search(MAX_INVITES);
        await tools.invite(found.map((c) => c.id));
      }
    },
  );

  if (tools.proposed) {
    await steps.set(STEP.end, "Esperar tu decisión", "Revisa la propuesta", "running");
  } else {
    await steps.set(STEP.move, "Proponer otro horario", "No encontré un horario mejor", "done");
  }
  await db.from("agent_runs").update({ passes: 2, next_check_at: null }).eq("id", run.id);
}

/** How many players the agent invited to the match, and how many of them signed up. */
async function acceptedCount(db: SupabaseClient, matchId: string) {
  const { data: invites } = await db.from("notices").select("user_id").eq("kind", "invite").eq("match_id", matchId);
  const invited = (invites ?? []).map((row) => row.user_id as string);
  if (invited.length === 0) return { accepted: 0, invited: 0 };
  const { count } = await db
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("match_id", matchId)
    .eq("status", "active")
    .in("player_id", invited);
  return { accepted: count ?? 0, invited: invited.length };
}

const terminate: Tool = {
  name: "terminar",
  description: "Termina esta pasada cuando ya no haya nada útil que hacer.",
  parameters: { type: "object", properties: { resumen: { type: "string" } } },
  run: async () => ({ ok: true }),
};

/** Asks the model to plan the pass; on any failure, or without a model, runs the rules. */
async function plan(tools: RescueTools, pass: "primera" | "segunda", available: Tool[], rules: () => Promise<void>) {
  if (llmConfig()) {
    try {
      return await runToolLoop(tools.systemPrompt(pass), tools.situation(), available);
    } catch {
      // Fall through to the rules; whatever the model already did stays done.
    }
  }
  await rules();
  return "rules";
}

class RescueTools {
  deadline: string;
  proposed = false;
  private found = new Map<string, Candidate>();
  private options_: MoveOption[] = [];

  constructor(
    private db: SupabaseClient,
    private match: MatchRow,
    private steps: Steps,
    private missing: number,
    private invited = 0,
  ) {
    this.deadline = match.confirmation_deadline;
  }

  private get title() {
    return this.match.title ?? `Reta en ${this.match.slot.field.name}`;
  }

  systemPrompt(pass: "primera" | "segunda") {
    return [
      "Eres el Agente Retta. Tu meta es que una reta de fútbol junte su mínimo de jugadores antes de su hora de cierre; si no lo junta, se cancela.",
      `Esta es tu ${pass} pasada sobre la reta.`,
      "Usa las herramientas. Invita solo a jugadores que te regrese buscar_jugadores, y no más de los necesarios con un margen razonable.",
      "Extiende el cierre solo si da más tiempo real. Propón otro horario solo si tiene más jugadores afines que los que faltan.",
      "Cuando no quede nada útil por hacer, llama a terminar.",
    ].join(" ");
  }

  situation() {
    const active = this.match.registrations[0]?.count ?? 0;
    return JSON.stringify({
      reta: this.title,
      cancha: this.match.slot.field.name,
      empieza: this.match.slot.starts_at,
      cierre: this.deadline,
      inscritos: active,
      minimo: this.match.min_players,
      maximo: this.match.max_players,
      faltan: this.missing,
      ya_invitados: this.invited,
      max_invitaciones: MAX_INVITES - this.invited,
    });
  }

  async search(limit: number) {
    const { data } = await this.db.rpc("agent_candidates", { p_match_id: this.match.id, p_limit: Math.min(Math.max(limit, 1), MAX_INVITES) });
    const list = (data ?? []) as Candidate[];
    list.forEach((c) => this.found.set(c.id, c));
    await this.steps.set(STEP.search, "Buscar jugadores afines", `${this.found.size} encontrados`, "done");
    return list;
  }

  async invite(ids: string[]) {
    const budget = MAX_INVITES - this.invited;
    const chosen = ids.filter((id) => this.found.has(id)).slice(0, Math.max(budget, 0));
    let sent = 0;
    for (const id of chosen) {
      const candidate = this.found.get(id)!;
      const { error } = await this.db.from("notices").insert({
        user_id: id,
        kind: "invite",
        match_id: this.match.id,
        data: { reason: this.reason(candidate), missing: this.missing },
      });
      if (!error) sent++;
    }
    this.invited += sent;
    if (this.invited > 0) {
      await this.steps.set(STEP.invite, `Invitar a ${this.invited}`, "Les llegó un aviso", "done");
    }
    return { invitados: sent };
  }

  async extend() {
    const start = new Date(this.match.slot.starts_at).getTime();
    const latest = new Date(start - 60 * 60 * 1000);
    const current = new Date(this.deadline);
    if (latest.getTime() <= current.getTime()) return { extendido: false, motivo: "ya_es_el_maximo" };
    const { data, error } = await this.db.rpc("agent_extend_deadline", { p_match_id: this.match.id, p_deadline: latest.toISOString() });
    if (error) return { extendido: false, motivo: error.message };
    this.deadline = data as string;
    await this.steps.set(STEP.extend, "Extender cierre", `${formatTime(current)} → ${formatTime(new Date(this.deadline))}`, "done");
    return { extendido: true, cierre: this.deadline };
  }

  async options() {
    const { data } = await this.db.rpc("agent_move_options", { p_match_id: this.match.id });
    this.options_ = (data ?? []) as MoveOption[];
    return this.options_;
  }

  async propose(slotId: string, reason: string) {
    const option = this.options_.find((o) => o.slot_id === slotId);
    if (!option || this.proposed) return { propuesto: false };
    const { data: run } = await this.db.from("agent_runs").select("id").eq("match_id", this.match.id).single();
    const { error } = await this.db.from("move_proposals").insert({
      match_id: this.match.id,
      run_id: run?.id,
      to_slot_id: slotId,
      reason,
    });
    if (error) return { propuesto: false, motivo: error.message };
    this.proposed = true;
    await this.steps.set(STEP.move, "Proponer otro horario", `${formatTime(new Date(option.starts_at))} en ${option.field_name}`, "done");
    return { propuesto: true };
  }

  private reason(c: Candidate) {
    if (c.same_field > 0) return `Juegas seguido en ${this.match.slot.field.name}`;
    if (c.same_hour > 0) return "Sueles jugar a esta hora";
    return "Estás libre a esa hora";
  }

  searchTool(): Tool {
    return {
      name: "buscar_jugadores",
      description: "Busca jugadores afines que no están inscritos ni ocupados a esa hora, ordenados por afinidad.",
      parameters: { type: "object", properties: { limite: { type: "integer", description: "Cuántos, máximo 10" } } },
      run: async (args) => {
        const list = await this.search(Number(args.limite) || this.missing * 2);
        return list.map((c) => ({ id: c.id, nombre: c.full_name, misma_cancha: c.same_field, misma_hora: c.same_hour, asistencias: c.attended }));
      },
    };
  }

  inviteTool(): Tool {
    return {
      name: "invitar",
      description: "Manda una invitación a la reta a los jugadores indicados.",
      parameters: { type: "object", properties: { ids: { type: "array", items: { type: "string" } } }, required: ["ids"] },
      run: async (args) => this.invite(Array.isArray(args.ids) ? (args.ids as string[]) : []),
    };
  }

  extendTool(): Tool {
    return {
      name: "extender_cierre",
      description: "Mueve la hora de cierre lo más tarde posible (1 h antes de empezar).",
      parameters: { type: "object", properties: {} },
      run: async () => this.extend(),
    };
  }

  optionsTool(): Tool {
    return {
      name: "buscar_horarios",
      description: "Lista horarios libres el mismo día, cerca de la hora original, con cuántos jugadores afines tiene cada cancha.",
      parameters: { type: "object", properties: {} },
      run: async () => this.options(),
    };
  }

  proposeTool(): Tool {
    return {
      name: "proponer_horario",
      description: "Propone al organizador mover la reta a uno de los horarios de buscar_horarios. Nada cambia sin su aprobación.",
      parameters: {
        type: "object",
        properties: { slot_id: { type: "string" }, motivo: { type: "string", description: "Una frase para el organizador" } },
        required: ["slot_id", "motivo"],
      },
      run: async (args) => this.propose(String(args.slot_id), String(args.motivo ?? "")),
    };
  }
}

/** The run's task list: one row per fixed position, updated in place. */
class Steps {
  constructor(
    private db: SupabaseClient,
    private runId: string,
  ) {}

  async set(position: number, title: string, result: string | null, state: "done" | "running" | "queued") {
    await this.db
      .from("agent_steps")
      .upsert({ run_id: this.runId, position, title, result, state, updated_at: new Date().toISOString() }, { onConflict: "run_id,position" });
  }

  /** Closes one step (if it exists) with a new result. */
  async update(position: number, result: string) {
    await this.db
      .from("agent_steps")
      .update({ state: "done", result, updated_at: new Date().toISOString() })
      .eq("run_id", this.runId)
      .eq("position", position);
  }

  /** Marks whatever is still running or queued as done with `result`. */
  async closeOpen(result: string) {
    await this.db
      .from("agent_steps")
      .update({ state: "done", result, updated_at: new Date().toISOString() })
      .eq("run_id", this.runId)
      .in("state", ["running", "queued"]);
  }
}
