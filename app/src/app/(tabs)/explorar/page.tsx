import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatDay, formatTime, isThisWeekend, relativeDay } from "@/lib/time";
import { MatchCard, type Match } from "./match-card";
import { NearMeList } from "./near-me-list";

export const metadata: Metadata = { title: "Explorar · Retta" };

const FILTERS = [
  { key: undefined, label: "Todas", empty: "No hay retas próximas" },
  { key: "cerca", label: "Cerca de mí", empty: "No hay retas próximas" },
  { key: "hoy", label: "Hoy", empty: "No hay retas hoy" },
  { key: "manana", label: "Mañana", empty: "No hay retas mañana" },
  { key: "finde", label: "Este fin", empty: "No hay retas este fin" },
  { key: "gratis", label: "Gratis", empty: "No hay retas gratis" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

interface MatchRow {
  id: string;
  title: string | null;
  price_cents: number;
  min_players: number;
  max_players: number;
  status: "pending" | "confirmed";
  confirmation_deadline: string;
  slot: {
    starts_at: string;
    field: { name: string; area: string | null; cover_image: string; latitude: number | null; longitude: number | null };
  };
  registrations: { count: number }[];
}

function toMatch(row: MatchRow): Match {
  const pesos = row.price_cents / 100;
  return {
    id: row.id,
    title: row.title ?? `Reta en ${row.slot.field.name}`,
    fieldName: row.slot.field.area ? `${row.slot.field.name} · ${row.slot.field.area}` : row.slot.field.name,
    cover: `/fotos/canchas/${row.slot.field.cover_image}.jpg`,
    startsAt: new Date(row.slot.starts_at),
    price: pesos === 0 ? "Gratis" : `$${pesos}`,
    isFree: pesos === 0,
    active: row.registrations[0]?.count ?? 0,
    min: row.min_players,
    max: row.max_players,
    pending: row.status === "pending",
    coords:
      row.slot.field.latitude !== null && row.slot.field.longitude !== null
        ? { lat: row.slot.field.latitude, lng: row.slot.field.longitude }
        : null,
  };
}

function matchesFilter(match: Match, filter: FilterKey, now: Date) {
  switch (filter) {
    case "hoy":
      return relativeDay(match.startsAt, now) === "Hoy";
    case "manana":
      return relativeDay(match.startsAt, now) === "Mañana";
    case "finde":
      return isThisWeekend(match.startsAt, now);
    case "gratis":
      return match.isFree;
    default:
      return true;
  }
}

/** "falta 1 para confirmar" while pending, "quedan 3 lugares" once confirmed. */
function progressNote(match: Match) {
  if (match.pending) {
    const missing = match.min - match.active;
    return missing === 1 ? "falta 1 para confirmar" : `faltan ${missing} para confirmar`;
  }
  const left = match.max - match.active;
  return left === 1 ? "queda 1 lugar" : `quedan ${left} lugares`;
}

export default async function Explorar({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const filter = FILTERS.find((item) => item.key === f) ?? FILTERS[0];
  const now = new Date();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: balanceCents }, { data: featured }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle(),
    supabase.rpc("my_balance"),
    supabase.rpc("featured_match"),
    supabase
      .from("matches")
      .select(
        "id, title, price_cents, min_players, max_players, status, confirmation_deadline, slot:slots!inner(starts_at, field:fields!inner(name, area, cover_image, latitude, longitude)), registrations(count)",
      )
      .neq("status", "cancelled")
      .gt("slots.starts_at", now.toISOString())
      .eq("registrations.status", "active")
      .returns<MatchRow[]>(),
  ]);

  // Cancelled and played matches are hidden; so is a pending match past its
  // deadline, which the deadline job is about to cancel.
  const upcoming = (rows ?? [])
    .filter((row) => !(row.status === "pending" && new Date(row.confirmation_deadline) <= now))
    .map(toMatch)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const featuredId = (featured as { id: string } | null)?.id;
  const highlight = filter.key === undefined ? upcoming.find((match) => match.id === featuredId) : undefined;
  const list = upcoming.filter((match) => match !== highlight && matchesFilter(match, filter.key, now));

  const firstName = profile?.full_name?.split(/\s+/)[0];
  const balance = Math.max(balanceCents ?? 0, 0) / 100;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-28">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] text-muted">Hola{firstName ? `, ${firstName}` : ""}</span>
          <Link
            href="/saldo"
            className="flex h-9 shrink-0 items-center rounded-full border border-line bg-surface px-2.5 text-[13px] font-bold text-ink"
          >
            Saldo ${balance}
          </Link>
        </div>
        <h1 className="font-display text-[32px] leading-none font-medium">Retas cerca de ti</h1>
      </div>

      <nav aria-label="Filtrar retas" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <ul className="flex w-max gap-2">
          {FILTERS.map((item) => {
            const active = item.key === filter.key;
            return (
              <li key={item.label}>
                <Link
                  href={item.key ? `/explorar?f=${item.key}` : "/explorar"}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-9 items-center gap-1.5 rounded-full px-[13px] text-sm ${
                    active ? "bg-action font-bold text-on-action" : "bg-surface font-semibold text-muted"
                  }`}
                >
                  {item.key === "cerca" && (
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 11l18-8-8 18-2-8z" />
                    </svg>
                  )}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {highlight && (
        <Link
          href={`/retas/${highlight.id}`}
          className="relative block h-[220px] overflow-hidden rounded-[22px] bg-elevated text-white"
        >
          <Image src={highlight.cover} alt="" fill priority sizes="448px" className="object-cover object-[center_60%]" />
          <span className="absolute top-3.5 left-3.5 rounded-full bg-action px-2.5 py-1 text-[11px] font-semibold tracking-[0.06em] text-on-action uppercase">
            {highlight.pending ? "Se está armando" : "Ya se armó"}
          </span>
          <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-scrim px-4 py-3.5 text-white">
            <span className="font-display text-[23px] leading-none font-medium">{highlight.title}</span>
            <span className="text-sm">
              {formatDay(highlight.startsAt, now)} · {formatTime(highlight.startsAt)} · {highlight.active}/{highlight.max} ·{" "}
              {progressNote(highlight)} · {highlight.price}
            </span>
          </span>
        </Link>
      )}

      <h2 className="mt-1 font-display text-[21px] font-medium">
        {highlight ? "Próximas" : filter.key === "cerca" ? "Más cerca de ti" : filter.label}
      </h2>

      {filter.key === "cerca" ? (
        <NearMeList matches={list.map((match) => ({ ...match, startsAt: match.startsAt.toISOString() }))} />
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Image src="/mascota/espera.png" alt="" width={120} height={120} />
          <p className="text-[15px] text-muted">{filter.empty}</p>
          {filter.key && (
            <Link href="/explorar" className="flex h-11 items-center rounded-full border border-line px-5 text-[15px] font-bold">
              Ver todas
            </Link>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((match) => (
            <li key={match.id}>
              <MatchCard match={match} now={now} />
            </li>
          ))}
        </ul>
      )}

    </main>
  );
}
