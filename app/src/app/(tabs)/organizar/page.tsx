import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AgentMark } from "@/components/agent-mark";
import { ModeSwitch } from "@/components/mode-switch";
import { MODE_COOKIE, parseMode } from "@/lib/mode";
import { describe, loadAgentNotes, ORGANIZED_SELECT, type OrganizedRow } from "@/lib/organized";
import { requireRole } from "@/lib/roles";
import { formatDay, formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Organizar · Retta" };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Organizer home (organizer mode B, 2026-11-06): the week at a glance and what needs attention. */
export default async function OrganizerHome() {
  const { supabase, user, role } = await requireRole(["player", "admin"]);
  const now = new Date();
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("matches").select(ORGANIZED_SELECT).eq("organizer_id", user.id).eq("registrations.status", "active").returns<OrganizedRow[]>(),
  ]);

  const all = (rows ?? []).filter((row) => row.status !== "cancelled");
  const startsAt = (row: OrganizedRow) => new Date(row.slot.starts_at).getTime();
  const week = all.filter((row) => startsAt(row) > now.getTime() && startsAt(row) < now.getTime() + 7 * DAY_MS);
  const players = week.reduce((sum, row) => sum + (row.registrations[0]?.count ?? 0), 0);
  const notReady = week.filter((row) => row.status === "pending").length;
  // Needs attention: matches still short of players, and attendance to take.
  const attention = all
    .filter((row) => {
      const info = describe(row, now);
      return info.attendance || (row.status === "pending" && startsAt(row) > now.getTime());
    })
    .sort((a, b) => startsAt(a) - startsAt(b));
  const agentNote = await loadAgentNotes(supabase, attention, now);
  const firstName = (profile?.full_name ?? "").split(/\s+/)[0];
  const mode = parseMode((await cookies()).get(MODE_COOKIE)?.value);

  const stats = [
    { value: week.length, label: week.length === 1 ? "reta esta semana" : "retas esta semana" },
    { value: players, label: "jugadores inscritos" },
    { value: notReady, label: notReady === 1 ? "falta por armarse" : "faltan por armarse" },
  ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 pt-14 pb-36 lg:max-w-[1000px]! lg:gap-[22px] lg:pt-10 lg:pb-12">
      {role === "player" && <ModeSwitch role="player" initial={mode} className="lg:hidden" />}
      <div className="flex items-end justify-between gap-4">
        <span className="flex flex-col gap-1.5">
          {firstName && <span className="text-[15px] text-muted">Hola, {firstName}</span>}
          <h1 className="text-[32px] leading-none font-extrabold tracking-tight lg:text-[40px]">Así van tus retas</h1>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 lg:gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1 rounded-[4px] bg-surface p-3 lg:p-[18px]">
            <span className="text-[24px] font-extrabold tracking-tight lg:text-[30px]">{stat.value}</span>
            <span className="text-xs text-muted lg:text-[13px]">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col">
        <span className="text-xs font-bold tracking-[0.04em] text-muted uppercase">Necesitan tu atención</span>
        {attention.length === 0 ? (
          <p className="py-6 text-[15px] text-muted">Todo en orden. Cuando una reta necesite algo, aparece aquí.</p>
        ) : (
          attention.map((row) => {
            const info = describe(row, now);
            const agent = agentNote(row);
            const active = row.registrations[0]?.count ?? 0;
            const when = new Date(row.slot.starts_at);
            return (
              <div key={row.id} className="flex items-center gap-3 border-b border-line py-4 lg:gap-[18px] lg:px-1">
                <span className="flex w-[54px] shrink-0 flex-col lg:w-[76px]">
                  <span className="text-xs font-bold text-muted uppercase">{formatDay(when, now)}</span>
                  <span className="text-[17px] font-extrabold lg:text-[20px]">{formatTime(when)}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-[16px] font-bold">{row.title ?? `Reta en ${row.slot.field.name}`}</span>
                  <span className="text-sm text-muted lg:truncate">
                    {row.slot.field.name} · {active} de {row.max_players} · <span className={info.accent ? "text-action" : ""}>{info.status}</span>
                  </span>
                  {agent && !info.attendance && (
                    <span className="flex items-center gap-2 text-[13px] text-muted">
                      <AgentMark size={16} pulse={agent.working} />
                      <span className="truncate">{agent.text}</span>
                    </span>
                  )}
                </span>
                <Link
                  href={info.attendance ? `/organizar/${row.id}/asistencia` : `/organizar/${row.id}`}
                  className={`flex h-9 shrink-0 items-center rounded-[4px] px-3.5 text-sm font-semibold ${info.attendance ? "bg-action text-on-action" : "border border-line"}`}
                >
                  {info.attendance ? "Asistencia" : "Gestionar"}
                </Link>
              </div>
            );
          })
        )}
        <Link href="/perfil/organizar" className="self-start pt-4 text-sm font-semibold text-muted hover:text-ink">
          Ver todas tus retas →
        </Link>
      </div>

      {/* Phones: the blue + for a new match, above the bottom nav. */}
      <Link
        href="/organizar/nueva"
        aria-label="Nueva reta"
        className="fixed right-5 bottom-[92px] z-10 flex size-14 items-center justify-center rounded-full bg-action text-on-action shadow-[0_10px_30px_rgb(0_0_0/0.5)] lg:hidden"
      >
        <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Link>
    </main>
  );
}
