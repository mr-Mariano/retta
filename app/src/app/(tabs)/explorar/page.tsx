import Image from "next/image";
import Form from "next/form";
import Link from "next/link";
import type { Metadata } from "next";
import { AgentMark } from "@/components/agent-mark";
import { BellLink } from "@/components/bell-link";
import { joinHref, loadNotices, type Notice } from "@/lib/notices";
import { createClient } from "@/lib/supabase/server";
import { formatDay, formatTime, isThisWeekend, relativeDay } from "@/lib/time";
import { dismissNotice } from "../../avisos/actions";
import { MatchCard, type Match } from "./match-card";
import { MatchPanel } from "./match-panel";
import { NearMeList } from "./near-me-list";
import { PanelLink } from "./panel-link";
import { coverSrc } from "@/lib/covers";

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
    cover: coverSrc(row.slot.field.cover_image),
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

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Text search on desktop: title, field or area. */
function matchesQuery(match: Match, query: string) {
  if (!query) return true;
  return normalize(`${match.title} ${match.fieldName}`).includes(query);
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

export default async function Explorar({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; q?: string; buscar?: string; reta?: string }>;
}) {
  const { f, q = "", buscar, reta } = await searchParams;
  const query = normalize(q);
  const filter = FILTERS.find((item) => item.key === f) ?? FILTERS[0];
  const now = new Date();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: balanceCents }, { data: featured }, { data: rows }, { count: unread }, notices] = await Promise.all([
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
    supabase
      .from("notices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .is("read_at", null)
      .is("dismissed_at", null),
    loadNotices(supabase, user!.id, 10),
  ]);
  const suggestion = notices.find(
    (notice) =>
      notice.kind === "reactivation" &&
      notice.open &&
      now.getTime() - new Date(notice.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000,
  );

  // Cancelled and played matches are hidden; so is a pending match past its
  // deadline, which the deadline job is about to cancel.
  const upcoming = (rows ?? [])
    .filter((row) => !(row.status === "pending" && new Date(row.confirmation_deadline) <= now))
    .map(toMatch)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const featuredId = (featured as { id: string } | null)?.id;
  const highlight = filter.key === undefined ? upcoming.find((match) => match.id === featuredId) : undefined;
  const list = upcoming.filter((match) => match !== highlight && matchesFilter(match, filter.key, now) && matchesQuery(match, query));
  // Desktop (option E): a start page with the big search box until the person searches or filters.
  const hero = filter.key === undefined && !query;
  const suggestionMatch = suggestion?.match ? upcoming.find((match) => match.id === suggestion.match!.id) : undefined;
  const picks = [...new Set([suggestionMatch, highlight, ...upcoming].filter((m): m is Match => Boolean(m) && m!.active < m!.max))].slice(0, 3);
  const params = new URLSearchParams();
  if (filter.key) params.set("f", filter.key);
  if (q) params.set("q", q);
  const closeHref = params.size ? `/explorar?${params}` : "/explorar";

  const firstName = profile?.full_name?.split(/\s+/)[0];
  const balance = Math.max(balanceCents ?? 0, 0) / 100;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-28">
      <div className="flex flex-col gap-0.5 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] text-muted">Hola{firstName ? `, ${firstName}` : ""}</span>
          <span className="flex items-center gap-2">
            <Link
              href="/saldo"
              className="flex h-9 shrink-0 items-center rounded-full border border-line bg-surface px-2.5 text-[13px] font-bold text-ink"
            >
              Saldo ${balance}
            </Link>
            <BellLink unread={unread ?? 0} />
          </span>
        </div>
        <h1 className="font-display text-[32px] leading-none font-medium">Retas cerca de ti</h1>
      </div>

      {suggestion && (
        <div className="lg:hidden">
          <AgentBubble notice={suggestion} now={now} />
        </div>
      )}

      {hero ? (
        <section className="hidden min-h-[calc(100dvh-160px)] flex-col justify-center gap-[22px] lg:flex">
          <h1 className="text-center font-display text-[40px] leading-none font-medium">
            ¿Dónde juegas hoy{firstName ? `, ${firstName}` : ""}?
          </h1>
          <SearchBox q={q} filter={filter.key} autoFocus={buscar === "1"} />
          {picks.length > 0 && (
            <>
              <h2 className="text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">El agente te sugiere</h2>
              <ul className="grid grid-cols-3 gap-3">
                {picks.map((match) => (
                  <li key={match.id}>
                    <PanelLink matchId={match.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-2.5">
                      <span className="relative h-24 overflow-hidden rounded-[10px] bg-elevated">
                        <Image src={match.cover} alt="" fill sizes="220px" className="object-cover" />
                      </span>
                      <span className="truncate text-[15px] font-semibold">{match.title}</span>
                      <span className="text-[13px] text-muted">
                        {formatDay(match.startsAt, now)} · {formatTime(match.startsAt)} · {match.price}
                      </span>
                    </PanelLink>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : (
        <div className="hidden flex-col gap-2 lg:flex">
          <SearchBox q={q} filter={filter.key} compact autoFocus={buscar === "1"} />
          <span className="text-[14px] text-muted">
            {list.length === 1 ? "1 reta" : `${list.length} retas`}
            {query ? ` para “${q}”` : ""}
          </span>
        </div>
      )}

      <nav aria-label="Filtrar retas" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] lg:hidden">
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

      <div className={hero ? "contents lg:hidden" : "contents"}>
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
      </div>

      {reta && <MatchPanel supabase={supabase} userId={user!.id} matchId={reta} closeHref={closeHref} />}
    </main>
  );
}

/**
 * The desktop search box (option E): large on the start page, compact above
 * the results. Filter chips sit inside it; an active one shows ✕ to remove it.
 */
function SearchBox({ q, filter, compact = false, autoFocus = false }: { q: string; filter: FilterKey; compact?: boolean; autoFocus?: boolean }) {
  const chipHref = (key: FilterKey) => {
    const params = new URLSearchParams();
    if (key && key !== filter) params.set("f", key);
    if (q) params.set("q", q);
    return params.size ? `/explorar?${params}` : "/explorar";
  };
  const chips = FILTERS.filter((item) => item.key && item.key !== "cerca");
  return (
    <Form
      action="/explorar"
      role="search"
      className={`flex flex-col gap-3.5 rounded-[26px] border border-line bg-surface ${compact ? "px-4 py-3" : "px-5 pt-4 pb-3.5 shadow-[0_10px_30px_rgb(0_0_0/0.35)]"}`}
    >
      {filter && <input type="hidden" name="f" value={filter} />}
      <label className="flex items-center gap-3">
        <span className="sr-only">Buscar retas</span>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-muted">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          id="buscar"
          name="q"
          type="search"
          defaultValue={q}
          autoFocus={autoFocus}
          placeholder="Busca por cancha, zona u hora…"
          className={`min-w-0 flex-1 bg-transparent text-ink placeholder:text-muted focus:outline-none ${compact ? "text-[16px]" : "text-[18px]"}`}
        />
        <button type="submit" aria-label="Buscar" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-action text-on-action">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </label>
      <div className="flex flex-wrap gap-2">
        {chips.map((item) => {
          const active = item.key === filter;
          return (
            <Link
              key={item.label}
              href={chipHref(item.key)}
              aria-current={active ? "page" : undefined}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${active ? "bg-action text-on-action" : "border border-line text-muted hover:text-ink"}`}
            >
              {item.label}
              {active && <span aria-label="Quitar filtro">✕</span>}
            </Link>
          );
        })}
      </div>
    </Form>
  );
}

/** "el jueves", "hoy", "mañana" for the agent's sentence. */
function dayPhrase(date: Date, now: Date) {
  const relative = relativeDay(date, now);
  if (relative) return relative.toLowerCase();
  return `el ${date.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", weekday: "long" })}`;
}

/** Reactivation from the agent: a chat bubble with quick replies (variant E). */
function AgentBubble({ notice, now }: { notice: Notice; now: Date }) {
  const match = notice.match!;
  const startsAt = new Date(match.startsAt);
  const left = match.max - match.active;
  const weeks = notice.lastPlayedAt
    ? Math.floor((now.getTime() - new Date(notice.lastPlayedAt).getTime()) / (7 * 24 * 60 * 60 * 1000))
    : null;
  const opener =
    weeks === null ? "¿Te animas a jugar esta semana?" : weeks <= 1 ? "Hace unos días que no juegas." : `Hace ${weeks} semanas que no juegas.`;
  const day = dayPhrase(startsAt, now);
  const chip = "flex h-[34px] items-center rounded-full px-3.5 text-sm font-semibold";
  return (
    <section aria-label="Sugerencia del Agente Retta" className="flex animate-rise-in items-start gap-2.5">
      <AgentMark size={34} />
      <div className="flex flex-1 flex-col gap-2">
        <p className="agent-glow rounded-[4px_18px_18px_18px] px-3.5 py-3 text-[16px] leading-[1.4]">
          {opener}{" "}
          <strong className="font-semibold">
            {day.charAt(0).toUpperCase() + day.slice(1)} a las {formatTime(startsAt)}
          </strong>{" "}
          hay reta en {match.fieldName}. {left === 1 ? "Queda 1 lugar." : `Quedan ${left} lugares.`}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Link href={joinHref(match)} className={`${chip} bg-action text-on-action`}>
            Me apunto
          </Link>
          <form action={dismissNotice.bind(null, notice.id)}>
            <button type="submit" className={`${chip} border border-line text-ink`}>
              Otro día
            </button>
          </form>
          <Link href="/explorar?f=cerca" className={`${chip} border border-line text-ink`}>
            Más opciones
          </Link>
        </div>
      </div>
    </section>
  );
}
