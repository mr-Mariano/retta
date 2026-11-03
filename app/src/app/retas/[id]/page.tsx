import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { dayKey, formatDay, formatLongDay, formatTime } from "@/lib/time";
import { MapButton } from "./map-sheet";
import { ShareButton } from "./share-button";
import { SignUpForm } from "./sign-up-form";

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
  searchParams: Promise<{ pago?: string }>;
}) {
  const [{ id }, { pago }] = await Promise.all([params, searchParams]);
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
  const cover = `/fotos/canchas/${field.cover_image}.jpg`;
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
    <main className="relative mx-auto min-h-dvh max-w-md pb-32">
      <div className="relative h-[280px] bg-elevated">
        <Image src={cover} alt="" fill priority sizes="448px" className="object-cover" />
        <Link
          href="/explorar"
          aria-label="Regresar"
          className="absolute top-[52px] left-4 flex size-11 items-center justify-center rounded-full bg-scrim text-white"
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="absolute top-[52px] right-4">
          <ShareButton title={title} />
        </div>
      </div>

      <div className="relative -mt-7 flex flex-col gap-4 rounded-t-3xl bg-base px-5 pt-5">
        <div className="flex flex-col gap-2">
          <span className="self-start rounded-full bg-elevated px-2.5 py-1 text-xs font-semibold">{statusLabel}</span>
          <h1 className="font-display text-[33px] leading-none font-medium">{title}</h1>
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
          <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-3.5">
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
            <span className="text-sm text-muted">{signUpsLine(match.registrations.map((r) => r.player.full_name))}</span>
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
  "flex h-[52px] w-full items-center justify-center rounded-full bg-action text-[17px] font-bold text-on-action";

type ActionState = "open" | "full" | "signedUp" | "locked" | "closed";

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
    <div className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md items-center gap-4 border-t border-line bg-surface px-5 pt-4 pb-8">
      {state === "signedUp" || state === "locked" ? (
        <>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[16px] font-bold">Estás inscrito</span>
            <span className="text-xs text-muted">{state === "locked" ? "Tu lugar está fijo" : `Baja con saldo hasta las ${deadline}`}</span>
          </div>
          {state === "signedUp" && (
            <Link
              href={`/retas/${matchId}/baja`}
              className="flex h-[52px] items-center justify-center rounded-full border border-line px-5 text-[16px] font-bold text-ink"
            >
              Darme de baja
            </Link>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-col">
            <span className="font-display text-[27px] leading-none font-medium">{price}</span>
            <span className="text-xs text-muted">por persona</span>
          </div>
          {state === "full" ? (
            <span aria-disabled="true" className="flex h-[52px] flex-1 items-center justify-center rounded-full bg-elevated text-[17px] font-bold text-muted">
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
    <div className="fixed inset-0 z-20 mx-auto max-w-md">
      <Link href={`/retas/${matchId}`} scroll={false} aria-label="Cerrar" className="absolute inset-0 bg-black/60" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pago-titulo"
        className="absolute inset-x-0 bottom-0 flex flex-col gap-[18px] rounded-t-[28px] border-t border-line bg-surface px-5 pt-3 pb-8"
      >
        <span aria-hidden="true" className="h-[5px] w-10 self-center rounded-full bg-line" />
        <h2 id="pago-titulo" className="font-display text-[28px] leading-none font-medium">
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
            <dd className="font-display text-[28px] leading-none font-medium">${total}</dd>
          </div>
        </dl>
        {total > 0 && (
          <span className="self-start rounded-full border border-dashed border-muted/60 px-3 py-1.5 text-[13px] font-semibold">
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

/** One dot per place (session 7): taken ones filled, the ones still missing for the minimum outlined in the accent. */
function CapacityDots({ active, min, max }: { active: number; min: number; max: number }) {
  return (
    <ol aria-label={`${active} de ${max} lugares ocupados, mínimo ${min}`} className="flex flex-wrap gap-1.5">
      {Array.from({ length: max }, (_, i) => (
        <li
          key={i}
          aria-hidden="true"
          className={`size-4 rounded-full ${
            i < active ? "bg-action" : i < min ? "border-[1.5px] border-action" : "border-[1.5px] border-muted/40"
          }`}
        />
      ))}
    </ol>
  );
}

function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-[13px] font-semibold">
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
