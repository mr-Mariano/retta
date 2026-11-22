import type { MatchRow, RunRow, RescueRepository } from "./repository";
import { formatTime } from "../time.ts";
import { MAX_INVITES, STEP, RescueActions, Steps } from "./rescue-actions.ts";
export type RescuePlanner = (
  pass: "primera" | "segunda",
  actions: RescueActions,
  missing: number,
  fallback: () => Promise<void>,
) => Promise<string>;

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
export interface RescueSummary {
  started: string[];
  rechecked: string[];
  finished: string[];
}

export async function rescueTick(repository: RescueRepository, now: Date, plan: RescuePlanner): Promise<RescueSummary> {
  const summary: RescueSummary = { started: [], rechecked: [], finished: [] };
  const runs = await repository.runningRescues();
  summary.finished = await finishSettledRuns(repository, runs);
  const runByMatch = new Map(runs.map((run) => [run.match_id, run]));
  const pending = await repository.pendingMatches();

  for (const match of pending) {
    const deadline = new Date(match.confirmation_deadline).getTime();
    const run = runByMatch.get(match.id);
    if ((run?.passes ?? 0) === 0 && (run || deadline - now.getTime() <= WINDOW_MS)) {
      const runId = await repository.claimRescue(match.id, 0);
      if (!runId) continue;
      await firstPass(repository, match, runId, now, plan);
      summary.started.push(match.id);
    } else if (run?.passes === 1 && run.next_check_at && new Date(run.next_check_at) <= now) {
      if (!await repository.claimRescue(match.id, 1)) continue;
      await secondPass(repository, match, run, plan);
      summary.rechecked.push(match.id);
    }
  }
  return summary;
}

/** Closes runs whose match is already confirmed or cancelled, or whose organizer stopped the agent. */
async function finishSettledRuns(repository: RescueRepository, runs: Awaited<ReturnType<RescueRepository["runningRescues"]>>) {
  const finished: string[] = [];
  for (const { id, match } of runs) {
    const steps = new Steps(repository, id);
    const active = match.registrations[0]?.count ?? 0;
    if (match.status === "confirmed") {
      const accepted = await repository.acceptedCount(match.id);
      await steps.update(STEP.wait, `${accepted.accepted} de ${accepted.invited} aceptaron`);
      await steps.closeOpen("No hizo falta");
      await steps.set(STEP.end, "¡Se armó la reta!", `${active} de ${match.min_players}`, "done");
      await repository.finishRescue(id, "finished", "rescued");
    } else if (match.status === "cancelled") {
      await steps.closeOpen("No se completó");
      await steps.set(STEP.end, "No se juntó el mínimo", "Todos recibieron su saldo", "done");
      await repository.finishRescue(id, "finished", "not_rescued");
    } else if (!match.agent_enabled) {
      await steps.closeOpen("Detenido");
      await steps.set(STEP.end, "Detuviste al agente", null, "done");
      await repository.finishRescue(id, "stopped", null);
    } else {
      continue;
    }
    finished.push(match.id);
  }
  return finished;
}

async function firstPass(repository: RescueRepository, match: MatchRow, runId: string, now: Date, plan: RescuePlanner) {
  const steps = new Steps(repository, runId);
  const active = match.registrations[0]?.count ?? 0;
  const missing = match.min_players - active;
  await steps.set(STEP.review, "Revisar la reta", `${active} de ${match.min_players} · faltan ${missing}`, "done");

  const { invited } = await repository.acceptedCount(match.id);
  const tools = new RescueActions(repository, match, steps, runId, missing, invited);
  const engine = await plan(
    "primera", tools, missing,
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
  await repository.savePass(runId, 1, nextCheck.toISOString(), engine);
}

async function secondPass(repository: RescueRepository, match: MatchRow, run: RunRow, plan: RescuePlanner) {
  const steps = new Steps(repository, run.id);
  const active = match.registrations[0]?.count ?? 0;
  const missing = match.min_players - active;

  const { accepted, invited } = await repository.acceptedCount(match.id);
  await steps.set(STEP.wait, "Esperar respuestas", `${accepted} de ${invited} aceptaron`, "done");

  const tools = new RescueActions(repository, match, steps, run.id, missing, invited);
  await plan(
    "segunda", tools, missing,
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
  await repository.savePass(run.id, 2, null);
}
