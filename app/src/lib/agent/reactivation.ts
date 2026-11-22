import type { Inactive, OpenMatch, ReactivationRepository } from "./repository";
import { TIME_ZONE } from "../time.ts";

/**
 * Reactivation: once a week, players with no sign-up in the last 14 days or
 * ahead get one concrete match suggestion (an Explore bubble), preferring the
 * fields they know and the hour they usually play. ODS 3: measured as players
 * who sign up again after a suggestion.
 */

export async function reactivationTick(repository: ReactivationRepository, now: Date) {
  const runId = await repository.beginReactivation();
  if (!runId) return { sent: 0, skipped: true };
  const inactive = await repository.inactivePlayers();
  await repository.setStep(runId, 1, "Buscar jugadores que dejaron de jugar", `${inactive.length} encontrados`, "done");
  const matchData = await repository.openMatches();
  const open = matchData.filter(
    (m) => (m.registrations[0]?.count ?? 0) < m.max_players && new Date(m.confirmation_deadline) > now,
  );

  let sent = 0;
  for (const player of inactive) {
    const best = open
      .map((m) => ({ match: m, score: score(m, player, now) }))
      .sort((a, b) => b.score - a.score)[0];
    if (!best) continue;
    const left = best.match.max_players - (best.match.registrations[0]?.count ?? 0);
    if (await repository.suggest(best.match.id, player, left)) sent++;
  }
  await repository.setStep(runId, 2, "Sugerir una reta a cada uno", `${sent} sugerencias`, "done");
  await repository.finishReactivation(runId);
  return { sent, skipped: false };
}

/** Known field, usual hour, and a pending match that needs people. */
function score(match: OpenMatch, player: Inactive, now: Date) {
  const hour = Number(
    new Date(match.slot.starts_at).toLocaleTimeString("en-US", { timeZone: TIME_ZONE, hour: "numeric", hour12: false }),
  );
  let value = 0;
  if (player.fields.includes(match.slot.field_id)) value += 3;
  if (player.usual_hour !== null) value += Math.max(0, 2 - Math.abs(hour - player.usual_hour));
  if (match.status === "pending") value += 1;
  // Sooner is better: lose a little per day.
  value -= (new Date(match.slot.starts_at).getTime() - now.getTime()) / (24 * 60 * 60 * 1000) / 3;
  return value;
}
