import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TIME_ZONE } from "@/lib/time";

/**
 * Reactivation: once a week, players with no sign-up in the last 14 days or
 * ahead get one concrete match suggestion (an Explore bubble), preferring the
 * fields they know and the hour they usually play. ODS 3: measured as players
 * who sign up again after a suggestion.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface Inactive {
  id: string;
  full_name: string;
  last_played_at: string | null;
  fields: string[];
  usual_hour: number | null;
}

interface OpenMatch {
  id: string;
  status: "pending" | "confirmed";
  max_players: number;
  confirmation_deadline: string;
  slot: { starts_at: string; field_id: string };
  registrations: { count: number }[];
}

export async function reactivationTick(db: SupabaseClient, now: Date, force: boolean) {
  if (!force) {
    const { count } = await db
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("kind", "reactivation")
      .gt("started_at", new Date(now.getTime() - WEEK_MS).toISOString());
    if ((count ?? 0) > 0) return { sent: 0, skipped: true };
  }

  const { data: run } = await db.from("agent_runs").insert({ kind: "reactivation" }).select("id").single();
  if (!run) return { sent: 0, skipped: true };

  const { data: inactiveData } = await db.rpc("agent_inactive_players");
  const inactive = (inactiveData ?? []) as Inactive[];
  await db.from("agent_steps").insert({
    run_id: run.id,
    position: 1,
    title: "Buscar jugadores que dejaron de jugar",
    result: `${inactive.length} encontrados`,
    state: "done",
  });

  // Open matches in the next 7 days that still take sign-ups.
  const { data: matchData } = await db
    .from("matches")
    .select("id, status, max_players, confirmation_deadline, slot:slots!inner(starts_at, field_id), registrations(count)")
    .neq("status", "cancelled")
    .gt("slots.starts_at", new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString())
    .lt("slots.starts_at", new Date(now.getTime() + WEEK_MS).toISOString())
    .eq("registrations.status", "active")
    .returns<OpenMatch[]>();
  const open = (matchData ?? []).filter(
    (m) => (m.registrations[0]?.count ?? 0) < m.max_players && new Date(m.confirmation_deadline) > now,
  );

  let sent = 0;
  for (const player of inactive) {
    const { data: mine } = await db.from("registrations").select("match_id").eq("player_id", player.id).eq("status", "active");
    const joined = new Set((mine ?? []).map((row) => row.match_id as string));
    const best = open
      .filter((m) => !joined.has(m.id))
      .map((m) => ({ match: m, score: score(m, player) }))
      .sort((a, b) => b.score - a.score)[0];
    if (!best) continue;
    const { error } = await db.from("notices").insert({
      user_id: player.id,
      kind: "reactivation",
      match_id: best.match.id,
      data: { last_played_at: player.last_played_at, left: best.match.max_players - (best.match.registrations[0]?.count ?? 0) },
    });
    if (!error) sent++;
  }

  await db.from("agent_steps").insert({
    run_id: run.id,
    position: 2,
    title: "Sugerir una reta a cada uno",
    result: `${sent} sugerencias`,
    state: "done",
  });
  await db
    .from("agent_runs")
    .update({ status: "finished", outcome: "sent", passes: 1, finished_at: new Date().toISOString() })
    .eq("id", run.id);
  return { sent, skipped: false };
}

/** Known field, usual hour, and a pending match that needs people. */
function score(match: OpenMatch, player: Inactive) {
  const hour = Number(
    new Date(match.slot.starts_at).toLocaleTimeString("en-US", { timeZone: TIME_ZONE, hour: "numeric", hour12: false }),
  );
  let value = 0;
  if (player.fields.includes(match.slot.field_id)) value += 3;
  if (player.usual_hour !== null) value += Math.max(0, 2 - Math.abs(hour - player.usual_hour));
  if (match.status === "pending") value += 1;
  // Sooner is better: lose a little per day.
  value -= (new Date(match.slot.starts_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000) / 3;
  return value;
}
