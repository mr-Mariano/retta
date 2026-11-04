import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Agente Retta · Retta" };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface MatchMinutes {
  id: string;
  status: string;
  slot: { starts_at: string; ends_at: string };
  registrations: { player_id: string; attendance: "unrecorded" | "present" | "absent"; created_at: string }[];
}

/**
 * The agent's impact this week (ODS 3), approved variant A: the mascot says
 * how many matches it saved, then minutes of football that were played
 * (confirmed attendance, or sign-ups while attendance is not taken yet, ×
 * duration) and two lines.
 */
export default async function AgenteImpacto() {
  await requireRole(["admin"]);
  // Counts span every player's notices, which RLS keeps private to each one.
  const db = createAdminClient();
  const now = Date.now();
  const since = new Date(now - WEEK_MS).toISOString();

  const [{ data: runs }, { data: suggestions }] = await Promise.all([
    db.from("agent_runs").select("match_id, outcome").eq("kind", "rescue").gt("started_at", since),
    db.from("notices").select("user_id, match_id, created_at").eq("kind", "reactivation").gt("created_at", since),
  ]);
  const rescued = (runs ?? []).filter((run) => run.outcome === "rescued").map((run) => run.match_id as string);
  const notRescued = (runs ?? []).filter((run) => run.outcome === "not_rescued").length;

  // Players who signed up again after a suggestion.
  const back = new Set<string>();
  const comebackMatches = new Map<string, Set<string>>();
  for (const notice of suggestions ?? []) {
    const { data: joined } = await db
      .from("registrations")
      .select("match_id")
      .eq("player_id", notice.user_id)
      .eq("status", "active")
      .gt("created_at", notice.created_at);
    for (const row of joined ?? []) {
      back.add(notice.user_id as string);
      const players = comebackMatches.get(row.match_id as string) ?? new Set<string>();
      players.add(notice.user_id as string);
      comebackMatches.set(row.match_id as string, players);
    }
  }

  const ids = [...new Set([...rescued, ...comebackMatches.keys()])];
  const { data: matches } = ids.length
    ? await db
        .from("matches")
        .select("id, status, slot:slots!inner(starts_at, ends_at), registrations(player_id, attendance, created_at)")
        .in("id", ids)
        .eq("registrations.status", "active")
        .returns<MatchMinutes[]>()
    : { data: [] as MatchMinutes[] };

  let played = 0;
  let scheduled = 0;
  for (const match of matches ?? []) {
    if (match.status !== "confirmed") continue;
    const minutes = (new Date(match.slot.ends_at).getTime() - new Date(match.slot.starts_at).getTime()) / 60_000;
    // A rescued match counts everyone; otherwise only the players who came back.
    const counted = rescued.includes(match.id)
      ? match.registrations
      : match.registrations.filter((r) => comebackMatches.get(match.id)?.has(r.player_id));
    const taken = counted.some((r) => r.attendance !== "unrecorded");
    const players = taken ? counted.filter((r) => r.attendance === "present").length : counted.length;
    if (new Date(match.slot.starts_at).getTime() <= now) played += players * minutes;
    else scheduled += players * minutes;
  }

  const saved = rescued.length;
  const line = "flex items-center gap-3 border-b border-line py-3.5";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-32">
      <Link href="/perfil" className="flex items-center gap-3 self-start text-[15px] font-semibold text-muted">
        <span className="flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </span>
        Perfil
      </Link>

      <div className="flex flex-col items-center gap-1 pt-2">
        <p className="relative rounded-[20px] border border-line bg-surface px-[18px] py-3 text-center text-[18px] font-semibold">
          {saved === 0 ? "Esta semana aún no salvo retas" : saved === 1 ? "Esta semana salvé 1 reta" : `Esta semana salvé ${saved} retas`}
          <span aria-hidden="true" className="absolute -bottom-[8px] left-1/2 size-3.5 -translate-x-1/2 rotate-45 border-r border-b border-line bg-surface" />
        </p>
        <Image src="/mascota/celebra.png" alt="Silbato celebrando" width={180} height={180} priority />
      </div>

      <div className="-mt-2 flex flex-col items-center gap-0.5 text-center">
        <span className="font-display text-[56px] leading-none font-medium">
          {Math.round(played).toLocaleString("es-MX")} <span className="text-[24px]">min</span>
        </span>
        <span className="text-[15px] text-muted">de fútbol que sí se jugó</span>
        {scheduled > 0 && (
          <span className="text-[13px] text-muted">y {Math.round(scheduled).toLocaleString("es-MX")} min más por jugarse</span>
        )}
      </div>

      <div className="flex flex-col">
        <div className={line}>
          <span className="w-14 font-display text-[28px] leading-none font-medium text-action">{back.size}</span>
          <span className="flex-1 text-[16px]">{back.size === 1 ? "jugador volvió a jugar" : "jugadores volvieron a jugar"}</span>
        </div>
        <div className={line}>
          <span className="w-14 font-display text-[28px] leading-none font-medium text-danger">{notRescued}</span>
          <span className="flex-1 text-[16px]">{notRescued === 1 ? "reta no se salvó" : "retas no se salvaron"}</span>
        </div>
      </div>
    </main>
  );
}
