import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CapacityDots } from "@/components/capacity-dots";
import { DropOutSheet } from "@/components/drop-out-sheet";
import { createClient } from "@/lib/supabase/server";
import { dayKey, formatDay, formatLongDay, formatTime } from "@/lib/time";
import { MapButton } from "./map-sheet";
import { PlayersSheet, type MatchPlayer } from "./players-sheet";
import { ToastStack } from "@/components/toast-stack";
import { CloseButton } from "./close-button";
import { ShareButton } from "./share-button";
import { SignUpForm } from "./sign-up-form";
import { coverSrc } from "@/lib/covers";

export const metadata: Metadata = { title: "Reta · Retta" };

interface MatchDetail {
  id: string;
  title: string | null;
  description: string | null;
  min_players: number;
  max_players: number;
  price_cents: number;
  status: "pending" | "confirmed" | "cancelled";
  confirmation_deadline: string;
  format: "fut5" | "fut7" | "fut11";
  level: "beginner" | "intermediate" | "advanced";
  type: "men" | "women" | "mixed";
  organizer: { full_name: string };
  slot: {
    starts_at: string;
    ends_at: string;
    field: {
      name: string;
      area: string | null;
      address: string;
      has_changing_rooms: boolean;
      cover_image: string;
      latitude: number | null;
      longitude: number | null;
    };
  };
  registrations: { player_id: string; created_at: string; player: { full_name: string } }[];
}

const FORMAT_LABEL = { fut5: "Fut 5", fut7: "Fut 7", fut11: "Fut 11" };

// Level bars (session 6): the bar count also encodes the level.
const LEVEL = {
  beginner: { label: "Principiante", bars: 1, color: "#4ADE80" },
  intermediate: { label: "Intermedio", bars: 2, color: "#FACC15" },
  advanced: { label: "Avanzado", bars: 3, color: "#F87171" },
};

const TYPE_LABEL = { men: "Varonil", women: "Femenil", mixed: "Mixto" };
const MEN_COLOR = "#60A5FA";
const WOMEN_COLOR = "#F472B6";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** "Van Ana, Luis, Carlos y 5 más" */
function signUpsLine(names: string[]) {
  if (names.length === 0) return "Aún no hay inscritos";
  const first = names.map((name) => name.split(/\s+/)[0]);
  if (first.length <= 3) {
    return `Van ${first.length === 1 ? first[0] : `${first.slice(0, -1).join(", ")} y ${first.at(-1)}`}`;
  }
  return `Van ${first.slice(0, 3).join(", ")} y ${first.length - 3} más`;
}

export default async function MatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pago?: string; baja?: string; jugadores?: string; jugador?: string; aviso?: string; saldo?: string; cobro?: string; armada?: string }>;
}) {
  const [{ id }, { pago, baja, jugadores, jugador, aviso, saldo, cobro, armada }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: match } = await supabase
    .from("matches")
    .select(
      "id, title, description, min_players, max_players, price_cents, status, confirmation_deadline, format, level, type, organizer:profiles!matches_organizer_id_fkey(full_name), slot:slots!inner(starts_at, ends_at, field:fields!inner(name, area, address, has_changing_rooms, cover_image, latitude, longitude)), registrations(player_id, created_at, player:profiles!registrations_player_id_fkey(full_name))",
    )
    .eq("id", id)
    .eq("registrations.status", "active")
    .order("created_at", { referencedTable: "registrations" })
    .returns<MatchDetail[]>()
    .maybeSingle();

  if (!match) notFound();

  const now = new Date();
  const field = match.slot.field;
  const startsAt = new Date(match.slot.starts_at);
  const endsAt = new Date(match.slot.ends_at);
  const deadline = new Date(match.confirmation_deadline);
  const title = match.title ?? `Reta en ${field.name}`;
  const active = match.registrations.length;
  const isSignedUp = match.registrations.some((registration) => registration.player_id === user?.id);
  const isFull = active >= match.max_players;
  const isCancelled = match.status === "cancelled";
  const isPast = startsAt <= now;
  const deadlinePassed = deadline <= now;
  const pesos = match.price_cents / 100;
  const level = LEVEL[match.level];

  const priceLabel = pesos === 0 ? "Gratis" : `$${pesos}`;
  const cover = coverSrc(field.cover_image);
  const actionState: ActionState =
    isCancelled || isPast
      ? "closed"
      : isSignedUp
        ? deadlinePassed
          ? "locked"
          : "signedUp"
        : isFull
          ? "full"
          : deadlinePassed && match.status === "pending"
            ? "closed"
            : "open";
  // Payment sheet (J04) over the detail; free matches skip it (session 5).
  const showSheet = pago === "1" && actionState === "open" && pesos > 0;
  const { data: balanceCents } = showSheet ? await supabase.rpc("my_balance") : { data: 0 };
  // Drop-out sheet (J07): only while the player can still drop out.
  const showDropOut = baja === "1" && actionState === "signedUp";
  const { data: myRegistration } = showDropOut
    ? await supabase
        .from("registrations")
        .select("transactions(type, amount_cents)")
        .eq("match_id", match.id)
        .eq("player_id", user!.id)
        .eq("status", "active")
        .returns<{ transactions: { type: string; amount_cents: number }[] }[]>()
        .maybeSingle()
    : { data: null };
  // Sign-up list and player card (session 7).
  const showPlayers = jugadores === "1" || Boolean(jugador);
  const { data: players } = showPlayers ? await supabase.rpc("match_players", { p_match_id: match.id }) : { data: null };
  const paidCents = (myRegistration?.transactions ?? [])
    .filter((t) => t.type === "charge" || t.type === "credit_used")
    .reduce((total, t) => total + t.amount_cents, 0);

  const statusLabel = isCancelled ? "Cancelada" : isPast ? "Jugada" : match.status === "confirmed" ? "Confirmada" : "Por confirmar";
  const closes =
    dayKey(deadline) === dayKey(startsAt)
      ? `cierra a las ${formatTime(deadline)}`
      : `cierra el ${formatDay(deadline, now).toLowerCase()} a las ${formatTime(deadline)}`;
  const missing = match.min_players - active;
  const left = match.max_players - active;
  // "Faltan 2" stands out; the rest of the line is secondary.
  const [capacityLead, capacityRest] =
    match.status === "pending"
      ? [missing === 1 ? "Falta 1" : `Faltan ${missing}`, ` para que se arme · ${closes}`]
      : left === 0
        ? ["Llena", ""]
        : ["Ya se armó", ` · ${left === 1 ? "queda 1 lugar" : `quedan ${left} lugares`}`];

  return (
    <main className="relative mx-auto min-h-dvh max-w-md pb-32 lg:grid lg:max-w-[980px]! lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-x-10 lg:pt-20 lg:pb-12">
      <CloseButton />
      <div className="relative h-[280px] bg-elevated lg:h-[260px] lg:overflow-hidden lg:rounded-[6px]">
        <Image src={cover} alt="" fill priority sizes="448px" className="object-cover" />
        <Link
          href="/explorar"
          aria-label="Regresar"
          className="absolute top-[52px] left-4 flex size-11 lg:hidden items-center justify-center rounded-full bg-scrim text-white"
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="absolute top-[52px] right-4 lg:hidden">
          <ShareButton title={title} />
        </div>
      </div>

      <div className="relative -mt-7 flex flex-col gap-4 rounded-t-[10px] bg-base px-5 pt-5 lg:col-start-1 lg:mt-0 lg:rounded-none lg:px-0 lg:pt-6">
        <div className="flex flex-col gap-2">
          <span className="self-start rounded-[6px] bg-elevated px-2.5 py-1 text-xs font-semibold">{statusLabel}</span>
          <h1 className="font-display text-[33px] leading-none font-extrabold tracking-tight">{title}</h1>
          <span className="text-[16px] font-semibold">
            {formatLongDay(startsAt)} · {formatTime(startsAt)}–{formatTime(endsAt)}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[16px] font-semibold">{field.name}</span>
              <span className="text-sm text-muted">{field.area ?? field.address}</span>
            </div>
            <MapButton
              field={{
                name: field.name,
                address: field.address,
                coords: field.latitude !== null && field.longitude !== null ? { lat: field.latitude, lng: field.longitude } : null,
              }}
            />
          </div>
        </div>

        {!isCancelled && (
          <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-3.5 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <CapacityDots active={active} min={match.min_players} max={match.max_players} />
              <span className="shrink-0 text-sm text-muted">
                {active}/{match.max_players}
              </span>
            </div>
            <span className="text-[16px]">
              <span className="font-semibold">{capacityLead}</span>
              <span className="text-muted">{capacityRest}</span>
            </span>
            {!isPast && match.status === "pending" && (
              <span className="text-[13px] leading-[1.45] text-muted">
                Si no se arma, la reta se cancela y te devolvemos el pago como saldo.
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-elevated text-sm font-bold">
            {initials(match.organizer.full_name)}
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">Organiza {match.organizer.full_name}</span>
            {match.registrations.some((r) => r.player_id !== user?.id) ? (
              <Link href={`/retas/${match.id}?jugadores=1`} scroll={false} className="text-sm text-muted underline decoration-line underline-offset-4">
                {signUpsLine(match.registrations.map((r) => r.player.full_name))}
              </Link>
            ) : (
              <span className="text-sm text-muted">{signUpsLine(match.registrations.map((r) => r.player.full_name))}</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <ul className="flex flex-wrap gap-2">
            <Chip icon={<FormatIcon />}>{FORMAT_LABEL[match.format]}</Chip>
            <Chip icon={<LevelIcon bars={level.bars} color={level.color} />}>{level.label}</Chip>
            <Chip icon={<TypeIcon type={match.type} />}>{TYPE_LABEL[match.type]}</Chip>
            {field.has_changing_rooms && <Chip icon={<ChangingRoomIcon />}>Vestidores</Chip>}
          </ul>
          {match.description && (
            <p className="flex items-start gap-2 text-sm text-muted">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                <path d="M8 3 4 5.5 5.5 9.5 7 9v12h10V9l1.5.5L20 5.5 16 3a4 4 0 0 1-8 0Z" />
              </svg>
              {match.description}
            </p>
          )}
        </div>
      </div>

      <ActionBar matchId={match.id} deadline={formatTime(deadline)} price={priceLabel} isFree={pesos === 0} state={actionState} />
      <DesktopActionCard
        matchId={match.id}
        title={title}
        deadline={formatTime(deadline)}
        price={priceLabel}
        isFree={pesos === 0}
        state={actionState}
        capacity={isCancelled ? null : { lead: capacityLead, rest: capacityRest, active, min: match.min_players, max: match.max_players }}
        pendingNote={!isPast && match.status === "pending"}
      />

      {showPlayers && players && (
        <PlayersSheet matchId={match.id} players={players as MatchPlayer[]} selectedId={jugador} />
      )}

      {showDropOut && (
        <DropOutSheet
          closeHref={`/retas/${match.id}`}
          info={{
            matchId: match.id,
            title: title,
            paidCents,
            active,
            min: match.min_players,
            max: match.max_players,
            confirmed: match.status === "confirmed",
          }}
        />
      )}

      {aviso === "dentro" && (
        <ToastStack
          key={`${saldo}-${cobro}`}
          toasts={[{ id: "dentro", message: joinedMessage(saldo, cobro, armada) }]}
          clearParams={["aviso", "saldo", "cobro", "armada"]}
        />
      )}

      {showSheet && (
        <PaymentSheet
          matchId={match.id}
          title={title}
          cover={cover}
          when={`${formatDay(startsAt, now)} · ${formatTime(startsAt)} · ${field.name}`}
          priceCents={match.price_cents}
          creditCents={Math.min(Math.max(balanceCents ?? 0, 0), match.price_cents)}
        />
      )}
    </main>
  );
}

const PRIMARY_BUTTON =
  "flex h-[52px] w-full items-center justify-center rounded-[6px] bg-action text-[17px] font-bold text-on-action";

type ActionState = "open" | "full" | "signedUp" | "locked" | "closed";

/** Toast after paying on desktop (success A): what was used to pay, or that the match got made. */
function joinedMessage(saldo?: string, cobro?: string, armada?: string) {
  const credit = Number(saldo) || 0;
  const charged = Number(cobro) || 0;
  if (armada === "1") return "¡Estás dentro y se armó la reta!";
  if (credit && charged) return `Estás dentro · $${credit} de saldo y $${charged} con tarjeta`;
  if (credit) return `Estás dentro · usaste $${credit} de saldo`;
  if (charged) return `Estás dentro · pagaste $${charged}`;
  return "Estás dentro";
}

/** Desktop (detail A): price, capacity and the action in a card that stays in view on the right. */
function DesktopActionCard({
  matchId,
  title,
  deadline,
  price,
  isFree,
  state,
  capacity,
  pendingNote,
}: {
  matchId: string;
  title: string;
  deadline: string;
  price: string;
  isFree: boolean;
  state: ActionState;
  capacity: { lead: string; rest: string; active: number; min: number; max: number } | null;
  pendingNote: boolean;
}) {
  return (
    <aside className="sticky top-20 col-start-2 row-span-2 row-start-1 hidden flex-col gap-4 rounded-[6px] bg-surface p-5 lg:flex">
      <span className="flex items-baseline justify-between">
        <span className="font-display text-[34px] leading-none font-extrabold tracking-tight">{price}</span>
        <span className="text-sm text-muted">por persona</span>
      </span>
      {capacity && (
        <span className="flex flex-col gap-2.5">
          <span className="text-[15px]">
            <span className="font-semibold">{capacity.lead}</span>
            <span className="text-muted">{capacity.rest}</span>
          </span>
          <CapacityDots active={capacity.active} min={capacity.min} max={capacity.max} size="sm" />
        </span>
      )}
      {pendingNote && <span className="text-[13px] leading-snug text-muted">Si no se arma, la reta se cancela y te devolvemos el pago como saldo.</span>}
      {state === "closed" ? (
        <span className="text-[15px] text-muted">Esta reta ya no acepta inscripciones.</span>
      ) : state === "signedUp" || state === "locked" ? (
        <>
          <span className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-(--color-bg-base)">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <span className="flex flex-col">
              <span className="text-[20px] font-extrabold tracking-tight">¡Estás dentro!</span>
              <span className="text-[13px] text-muted">{state === "locked" ? "Tu lugar está fijo" : `Baja con saldo hasta las ${deadline}`}</span>
            </span>
          </span>
          {state === "signedUp" && (
            <Link href={`/retas/${matchId}?baja=1`} scroll={false} className="flex h-12 items-center justify-center rounded-[6px] border border-line text-[16px] font-semibold">
              Darme de baja
            </Link>
          )}
        </>
      ) : state === "full" ? (
        <span className="flex h-12 items-center justify-center rounded-[6px] bg-elevated text-[16px] font-bold text-muted">Llena</span>
      ) : isFree ? (
        <SignUpForm matchId={matchId} label="Inscribirme" className={PRIMARY_BUTTON} />
      ) : (
        <Link href={`/retas/${matchId}?pago=1`} scroll={false} className={PRIMARY_BUTTON}>
          Inscribirme
        </Link>
      )}
      <span className="flex justify-center pt-1 [&_button]:size-auto [&_button]:gap-2 [&_button]:bg-transparent [&_button]:text-sm [&_button]:font-semibold [&_button]:text-muted">
        <ShareButton title={title} />
      </span>
    </aside>
  );
}

function ActionBar({
  matchId,
  deadline,
  price,
  isFree,
  state,
}: {
  matchId: string;
  deadline: string;
  price: string;
  isFree: boolean;
  state: ActionState;
}) {
  if (state === "closed") return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md items-center gap-4 lg:hidden border-t border-line bg-surface px-5 pt-4 pb-8">
      {state === "signedUp" || state === "locked" ? (
        <>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[16px] font-bold">Estás inscrito</span>
            <span className="text-xs text-muted">{state === "locked" ? "Tu lugar está fijo" : `Baja con saldo hasta las ${deadline}`}</span>
          </div>
          {state === "signedUp" && (
            <Link
              href={`/retas/${matchId}?baja=1`}
              scroll={false}
              className="flex h-[52px] items-center justify-center rounded-[6px] border border-line px-5 text-[16px] font-bold text-ink"
            >
              Darme de baja
            </Link>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-col">
            <span className="font-display text-[27px] leading-none font-extrabold tracking-tight">{price}</span>
            <span className="text-xs text-muted">por persona</span>
          </div>
          {state === "full" ? (
            <span aria-disabled="true" className="flex h-[52px] flex-1 items-center justify-center rounded-[6px] bg-elevated text-[17px] font-bold text-muted">
              Llena
            </span>
          ) : isFree ? (
            <SignUpForm matchId={matchId} label="Inscribirme" className={PRIMARY_BUTTON} formClassName="flex-1" />
          ) : (
            <Link
              href={`/retas/${matchId}?pago=1`}
              scroll={false}
              className={`flex-1 ${PRIMARY_BUTTON}`}
            >
              Inscribirme
            </Link>
          )}
        </>
      )}
    </div>
  );
}

function PaymentSheet({
  matchId,
  title,
  cover,
  when,
  priceCents,
  creditCents,
}: {
  matchId: string;
  title: string;
  cover: string;
  when: string;
  priceCents: number;
  creditCents: number;
}) {
  const total = (priceCents - creditCents) / 100;
  return (
    <div className="fixed inset-0 z-30 mx-auto max-w-md lg:max-w-none!">
      <Link href={`/retas/${matchId}`} scroll={false} aria-label="Cerrar" className="absolute inset-0 animate-fade-in bg-black/60" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pago-titulo"
        className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] animate-sheet-up flex-col overflow-y-auto gap-[18px] rounded-t-[10px] border-t border-line bg-surface px-5 pt-3 pb-8 lg:inset-x-auto lg:bottom-auto lg:top-1/2 lg:left-1/2 lg:w-[480px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:animate-fade-in lg:rounded-[8px] lg:border lg:border-line lg:pb-6 lg:shadow-[0_30px_60px_rgb(0_0_0/0.6)]"
      >
        <span aria-hidden="true" className="h-[5px] w-10 self-center rounded-[6px] bg-line lg:hidden" />
        <h2 id="pago-titulo" className="font-display text-[28px] leading-none font-extrabold tracking-tight">
          Confirma tu inscripción
        </h2>
        <div className="flex items-center gap-3">
          <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-elevated">
            <Image src={cover} alt="" fill sizes="56px" className="object-cover" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[16px] font-bold">{title}</span>
            <span className="truncate text-sm text-muted">{when}</span>
          </span>
        </div>
        <dl className="flex flex-col gap-2.5 rounded-2xl border border-line bg-base p-4 text-[15px]">
          <div className="flex justify-between">
            <dt className="text-muted">Precio</dt>
            <dd>${priceCents / 100}</dd>
          </div>
          {creditCents > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Saldo aplicado</dt>
              <dd>−${creditCents / 100}</dd>
            </div>
          )}
          <div aria-hidden="true" className="h-px bg-line" />
          <div className="flex items-baseline justify-between">
            <dt className="font-semibold">Total a pagar</dt>
            <dd className="font-display text-[28px] leading-none font-extrabold tracking-tight">${total}</dd>
          </div>
        </dl>
        {total > 0 && (
          <span className="self-start rounded-[6px] border border-dashed border-muted/60 px-3 py-1.5 text-[13px] font-semibold">
            Pago de prueba · no se cobra dinero real
          </span>
        )}
        <SignUpForm matchId={matchId} label={total > 0 ? `Pagar $${total} (prueba)` : "Usar saldo"} className={PRIMARY_BUTTON} />
        <Link href={`/retas/${matchId}`} scroll={false} className="flex h-11 items-center self-center px-4 text-[15px] font-semibold text-muted">
          Cancelar
        </Link>
      </section>
    </div>
  );
}

function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex h-7 items-center gap-1.5 rounded-[6px] border border-line bg-surface px-2.5 text-[13px] font-semibold">
      {icon}
      {children}
    </li>
  );
}

function FormatIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M12 5v14" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function LevelIcon({ bars, color }: { bars: number; color: string }) {
  const heights = [7, 12, 17];
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      {heights.map((height, i) => (
        <rect
          key={height}
          x={3 + i * 6.75}
          y={21 - height}
          width="4.5"
          height={height}
          rx="1.5"
          fill={i < bars ? color : "var(--color-border-default)"}
        />
      ))}
    </svg>
  );
}

function TypeIcon({ type }: { type: "men" | "women" | "mixed" }) {
  const single = type === "men" ? MEN_COLOR : WOMEN_COLOR;
  if (type !== "mixed") {
    return (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={single} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <g stroke={MEN_COLOR}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0" />
      </g>
      <g stroke={WOMEN_COLOR}>
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16 14.2a5 5 0 0 1 5 5.8" />
      </g>
    </svg>
  );
}

function ChangingRoomIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
      <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16" />
      <path d="M2 21h20" />
      <path d="M14 12h.01" />
    </svg>
  );
}
