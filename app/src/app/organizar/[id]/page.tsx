import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { CapacityDots } from "@/components/capacity-dots";
import { ToastStack } from "@/components/toast-stack";
import { formatDay, formatTime } from "@/lib/time";
import { decideMove } from "../actions";
import { AgentCard, type AgentRun, type Proposal } from "./agent-card";
import { CancelForm } from "./cancel-form";
import { loadOrganizerMatch } from "./match-data";
import { createClient } from "@/lib/supabase/server";
import { AgentMark } from "@/components/agent-mark";

export const metadata: Metadata = { title: "Gestionar reta · Retta" };

const TINTS = ["#2B3A66", "#4A2F5E", "#5E4A2F", "#2F5E4A", "#5E2F3A"];
const tint = (name: string) => TINTS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TINTS.length];
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

const NOTICES: Record<string, string> = {
  publicada: "Reta publicada",
  movida: "Moviste la reta. Les avisamos a los inscritos",
  "propuesta-no": "La reta se queda como está",
  proposal_not_pending: "Esa propuesta ya no está vigente",
  slot_taken: "Ese horario ya lo tomó otra reta",
  proposal_expired: "Ya es tarde para mover la reta",
  match_cancelled: "La reta ya se canceló",
  error: "No se pudo completar. Intenta de nuevo",
};

/** The agent's rescue run for this match (with its steps) and a pending move proposal. */
async function loadAgent(matchId: string): Promise<{ run: AgentRun | null; proposal: Proposal | null }> {
  const supabase = await createClient();
  const [{ data: run }, { data: proposal }] = await Promise.all([
    supabase
      .from("agent_runs")
      .select("status, outcome, started_at, steps:agent_steps(position, title, result, state)")
      .eq("kind", "rescue")
      .eq("match_id", matchId)
      .order("position", { referencedTable: "steps" })
      .returns<AgentRun[]>()
      .maybeSingle(),
    supabase
      .from("move_proposals")
      .select("id, reason, slot:slots!inner(starts_at, field:fields!inner(name))")
      .eq("match_id", matchId)
      .eq("status", "pending")
      .returns<{ id: string; reason: string; slot: { starts_at: string; field: { name: string } } }[]>()
      .maybeSingle(),
  ]);
  return {
    run: run ?? null,
    proposal: proposal ? { id: proposal.id, starts_at: proposal.slot.starts_at, field_name: proposal.slot.field.name, reason: proposal.reason } : null,
  };
}

/** wa.me link with the message already written; without a phone it opens the share sheet. */
function whatsapp(text: string, phone?: string | null) {
  const to = phone ? phone.replace(/\D/g, "") : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

export default async function GestionarReta({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cancelar?: string; propuesta?: string; aviso?: string }>;
}) {
  const [{ id }, { cancelar, propuesta, aviso }] = await Promise.all([params, searchParams]);
  const match = await loadOrganizerMatch(id);
  const { run, proposal } = await loadAgent(match.id);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;

  const now = new Date();
  const startsAt = new Date(match.slot.starts_at);
  const endsAt = new Date(match.slot.ends_at);
  const title = match.title ?? `Reta en ${match.slot.field.name}`;
  const players = match.registrations;
  const active = players.length;
  const started = startsAt <= now;
  const canCancel = match.status !== "cancelled" && !started;
  const attendanceOpen = match.status === "confirmed" && started && now.getTime() - startsAt.getTime() < 24 * 60 * 60 * 1000;
  const when = `${formatDay(startsAt, now).toLowerCase()} a las ${formatTime(startsAt)}`;
  const reminder = (name?: string) =>
    `${name ? `Hola ${name.split(/\s+/)[0]}` : "Hola"}, te recuerdo: ${title}, ${when} en ${match.slot.field.name}. ${origin}/retas/${match.id}`;

  const statusLabel =
    match.status === "cancelled" ? "Cancelada" : started ? "En juego" : match.status === "confirmed" ? "Confirmada" : "Por confirmar";
  const missing = match.min_players - active;
  const summary =
    match.status === "pending"
      ? [missing === 1 ? "Falta 1" : `Faltan ${missing}`, ` para que se arme · cierra ${formatTime(new Date(match.confirmation_deadline))}`]
      : match.status === "confirmed"
        ? ["Ya se armó", ` · ${match.max_players - active} lugares libres`]
        : ["Cancelada", ""];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-10">
      <Link href="/perfil/organizar" className="flex items-center gap-3 self-start text-[15px] font-semibold text-muted">
        <span className="flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </span>
        Tus retas
      </Link>

      <div className="flex flex-col gap-1.5">
        <span className="self-start rounded-full bg-elevated px-2.5 py-1 text-xs font-semibold">{statusLabel}</span>
        <h1 className="font-display text-[32px] leading-none font-medium">{title}</h1>
        <span className="text-[15px] text-muted">
          {formatDay(startsAt, now)} · {formatTime(startsAt)}–{formatTime(endsAt)} · {match.slot.field.name}
        </span>
      </div>

      {match.status !== "cancelled" && (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-3.5">
          <div className="flex items-center justify-between gap-3">
            <CapacityDots active={active} min={match.min_players} max={match.max_players} />
            <span className="shrink-0 text-sm text-muted">
              {active}/{match.max_players}
            </span>
          </div>
          <span className="text-[16px]">
            <span className="font-semibold">{summary[0]}</span>
            <span className="text-muted">{summary[1]}</span>
          </span>
        </div>
      )}

      {match.status !== "cancelled" && !started && (run || match.status === "pending") && (
        <AgentCard matchId={match.id} run={run} enabled={match.agent_enabled} proposal={proposal} />
      )}

      {attendanceOpen && (
        <Link href={`/organizar/${match.id}/asistencia`} className="flex h-12 items-center justify-center rounded-full bg-action text-[16px] font-semibold text-on-action">
          Pasar asistencia
        </Link>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[21px] font-medium">Inscritos ({active})</h2>
        {active > 0 && match.status !== "cancelled" && (
          <a
            href={whatsapp(reminder())}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[38px] items-center gap-1.5 rounded-full bg-action px-3.5 text-sm font-semibold text-on-action"
          >
            <WhatsAppIcon size={17} />
            Recordar a todos
          </a>
        )}
      </div>
      {active > 0 && match.status !== "cancelled" && (
        <p className="-mt-2.5 text-[13px] leading-snug text-muted">
          Abre WhatsApp con el mensaje listo para enviarlo al grupo de la reta. El ícono de cada jugador le escribe solo a él.
        </p>
      )}

      {active === 0 ? (
        <p className="text-[15px] text-muted">Aún no hay inscritos.</p>
      ) : (
        <ul className="-mt-2 flex flex-col divide-y divide-line">
          {players.map((registration) => (
            <li key={registration.id} className="flex items-center gap-3 py-2.5">
              <span
                aria-hidden="true"
                style={{ background: tint(registration.player.full_name) }}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
              >
                {initials(registration.player.full_name)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold">{registration.player.full_name}</span>
                <span className="text-xs text-muted">Inscrito {formatDay(new Date(registration.created_at), now).toLowerCase()}</span>
              </span>
              {registration.player.phone && match.status !== "cancelled" && (
                <a
                  href={whatsapp(reminder(registration.player.full_name), registration.player.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Recordar por WhatsApp a ${registration.player.full_name}`}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line text-ink"
                >
                  <WhatsAppIcon size={18} />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {canCancel && (
        <div className="mt-auto flex flex-col gap-2 pt-4">
          {active > 0 && <span className="text-center text-[13px] text-muted">Ya hay inscritos: no se puede editar, solo cancelar.</span>}
          <Link
            href={`/organizar/${match.id}?cancelar=1`}
            scroll={false}
            className="flex h-12 items-center justify-center rounded-full border border-line text-[16px] font-semibold text-danger"
          >
            Cancelar reta
          </Link>
        </div>
      )}

      {cancelar === "1" && canCancel && (
        <div className="fixed inset-0 z-30 mx-auto max-w-md">
          <Link href={`/organizar/${match.id}`} scroll={false} aria-label="Cerrar" className="absolute inset-0 animate-fade-in bg-black/60" />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancelar-titulo"
            className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] animate-sheet-up flex-col gap-4 overflow-y-auto rounded-t-[28px] border-t border-line bg-surface px-5 pt-3 pb-8"
          >
            <span aria-hidden="true" className="h-[5px] w-10 self-center rounded-full bg-line" />
            <div className="flex flex-col gap-1">
              <h2 id="cancelar-titulo" className="font-display text-[28px] leading-none font-medium">
                ¿Cancelar la reta?
              </h2>
              <span className="text-[15px] text-muted">
                {title} · {when}
              </span>
            </div>
            <ul className="flex flex-col gap-2.5 text-[15px] leading-[1.45]">
              <li className="flex gap-2.5">
                <span aria-hidden="true">·</span>
                <span>
                  {active > 0 ? (
                    <>
                      Los <strong className="font-semibold">{active} inscritos</strong> reciben lo que pagaron como saldo.
                    </>
                  ) : (
                    "Todavía no hay inscritos."
                  )}
                </span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden="true">·</span>
                <span>El horario queda libre en la cancha.</span>
              </li>
              <li className="flex gap-2.5 text-muted">
                <span aria-hidden="true">·</span>
                <span>Verán la reta como cancelada, con tu motivo.</span>
              </li>
            </ul>
            <CancelForm matchId={match.id} />
            <Link href={`/organizar/${match.id}`} scroll={false} className="flex h-12 items-center justify-center rounded-full border border-line text-[16px] font-semibold text-ink">
              Mejor no
            </Link>
          </section>
        </div>
      )}

      {propuesta === "1" && proposal && match.status !== "cancelled" && (
        <ProposalSheet matchId={match.id} title={title} startsAt={startsAt} fieldName={match.slot.field.name} active={active} min={match.min_players} proposal={proposal} />
      )}

      <ToastStack key={aviso} toasts={aviso && NOTICES[aviso] ? [{ id: aviso, message: NOTICES[aviso] }] : []} clearParams={["aviso"]} />
    </main>
  );
}

function WhatsAppIcon({ size }: { size: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21l1.7-5A9 9 0 1 1 8 19.3z" />
      <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.5-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2z" />
    </svg>
  );
}

/** The agent's proposal to move the match (approved design): now vs. proposed, why, and what happens to sign-ups. */
function ProposalSheet({
  matchId,
  title,
  startsAt,
  fieldName,
  active,
  min,
  proposal,
}: {
  matchId: string;
  title: string;
  startsAt: Date;
  fieldName: string;
  active: number;
  min: number;
  proposal: Proposal;
}) {
  const to = new Date(proposal.starts_at);
  return (
    <div className="fixed inset-0 z-30 mx-auto max-w-md">
      <Link href={`/organizar/${matchId}`} scroll={false} aria-label="Cerrar" className="absolute inset-0 animate-fade-in bg-black/60" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="propuesta-titulo"
        className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] animate-sheet-up flex-col gap-4 overflow-y-auto rounded-t-[28px] border-t border-line bg-surface px-5 pt-3 pb-8"
      >
        <span aria-hidden="true" className="h-[5px] w-10 self-center rounded-full bg-line" />
        <span className="flex items-center gap-1.5 text-[13px] text-muted">
          <AgentMark size={20} />
          <span className="font-semibold text-ink">Agente Retta</span>
        </span>
        <h2 id="propuesta-titulo" className="-mt-1.5 font-display text-[28px] leading-[1.05] font-medium">
          ¿Movemos tu reta a las {formatTime(to)}?
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 flex-col gap-0.5 rounded-[14px] border border-line bg-elevated p-3">
            <span className="text-xs font-semibold tracking-[0.05em] text-muted uppercase">Ahora</span>
            <span className="font-display text-[22px] leading-none font-medium">{formatTime(startsAt)}</span>
            <span className="text-[13px]">{fieldName}</span>
            <span className="text-xs text-muted">
              {active} de {min} mínimo
            </span>
          </div>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          <div className="flex flex-1 flex-col gap-0.5 rounded-[14px] border border-action/45 bg-action/15 p-3">
            <span className="text-xs font-semibold tracking-[0.05em] text-muted uppercase">Propuesta</span>
            <span className="font-display text-[22px] leading-none font-medium">{formatTime(to)}</span>
            <span className="text-[13px]">{proposal.field_name}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-[15px] leading-[1.45]">
          <span>
            <strong className="font-semibold">Por qué:</strong> {proposal.reason}
          </span>
          <span className="text-muted">Les aviso a los {active} inscritos de {title}. Quien no pueda se da de baja con saldo completo.</span>
        </div>
        <form action={decideMove.bind(null, matchId, proposal.id, true)}>
          <button type="submit" className="h-[52px] w-full rounded-full bg-action text-[17px] font-semibold text-on-action">
            Mover a las {formatTime(to)}
          </button>
        </form>
        <form action={decideMove.bind(null, matchId, proposal.id, false)}>
          <button type="submit" className="h-12 w-full rounded-full border border-line text-[16px] font-semibold text-ink">
            Dejarla como está
          </button>
        </form>
      </section>
    </div>
  );
}
