import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { DropOutSheet } from "@/components/drop-out-sheet";
import { ToastStack } from "@/components/toast-stack";
import { createClient } from "@/lib/supabase/server";
import { dayKey, formatDay, formatTime } from "@/lib/time";
import { coverSrc } from "@/lib/covers";

export const metadata: Metadata = { title: "Mis retas · Retta" };

interface RegistrationRow {
  id: string;
  status: "active" | "dropped" | "match_cancelled";
  attendance: "unrecorded" | "present" | "absent";
  created_at: string;
  transactions: { type: string; amount_cents: number }[];
  match: {
    id: string;
    title: string | null;
    status: "pending" | "confirmed" | "cancelled";
    min_players: number;
    max_players: number;
    confirmation_deadline: string;
    slot: { starts_at: string; field: { name: string; cover_image: string } };
    registrations: { count: number }[];
  };
}

interface Item {
  registrationId: string;
  matchId: string;
  title: string;
  fieldName: string;
  cover: string;
  startsAt: Date;
  deadline: Date;
  active: number;
  min: number;
  max: number;
  confirmed: boolean;
  paidCents: number;
  /** Label over the photo and whether it uses the accent. */
  status: { label: string; accent: boolean };
  note: string;
  canDrop: boolean;
}

/** "las 18:00" on the match day, otherwise "el jue 5 nov a las 18:00". */
function deadlinePhrase(deadline: Date, startsAt: Date, now: Date) {
  return dayKey(deadline) === dayKey(startsAt)
    ? `las ${formatTime(deadline)}`
    : `el ${formatDay(deadline, now).toLowerCase()} a las ${formatTime(deadline)}`;
}

function toItem(row: RegistrationRow, now: Date): Item {
  const { match } = row;
  const startsAt = new Date(match.slot.starts_at);
  const deadline = new Date(match.confirmation_deadline);
  const active = match.registrations[0]?.count ?? 0;
  const upcoming = row.status === "active" && match.status !== "cancelled" && startsAt > now;
  const canDrop = upcoming && deadline > now;

  let status: Item["status"];
  let note: string;
  if (upcoming) {
    status = match.status === "confirmed" ? { label: "¡Ya se armó!", accent: true } : { label: "Por confirmar", accent: false };
    note = canDrop
      ? `${active}/${match.max_players} · puedes darte de baja hasta ${deadlinePhrase(deadline, startsAt, now)}`
      : "Tu lugar está fijo: ya pasó la hora límite";
  } else if (row.status === "dropped") {
    status = { label: "Te diste de baja", accent: false };
    note = "Lo que pagaste volvió como saldo";
  } else if (match.status === "cancelled" || row.status === "match_cancelled") {
    status = { label: "Cancelada", accent: false };
    note = "No se armó: lo que pagaste volvió como saldo";
  } else {
    status = { label: "Jugada", accent: false };
    note = row.attendance === "present" ? "Asististe" : row.attendance === "absent" ? "No asististe" : "Asistencia sin registrar";
  }

  return {
    registrationId: row.id,
    matchId: match.id,
    title: match.title ?? `Reta en ${match.slot.field.name}`,
    fieldName: match.slot.field.name,
    cover: coverSrc(match.slot.field.cover_image),
    startsAt,
    deadline,
    active,
    min: match.min_players,
    max: match.max_players,
    confirmed: match.status === "confirmed",
    paidCents: row.transactions
      .filter((t) => t.type === "charge" || t.type === "credit_used")
      .reduce((total, t) => total + t.amount_cents, 0),
    status,
    note,
    canDrop,
  };
}

const TABS = [
  { key: undefined, label: "Próximas" },
  { key: "historial", label: "Historial" },
] as const;

export default async function MisRetas({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; baja?: string; aviso?: string; saldo?: string }>;
}) {
  const { tab, baja, aviso, saldo } = await searchParams;
  const history = tab === "historial";
  const now = new Date();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from("registrations")
    .select(
      "id, status, attendance, created_at, transactions(type, amount_cents), match:matches!inner(id, title, status, min_players, max_players, confirmation_deadline, slot:slots!inner(starts_at, field:fields!inner(name, cover_image)), registrations(count))",
    )
    .eq("player_id", user!.id)
    .eq("match.registrations.status", "active")
    .returns<RegistrationRow[]>();

  const items = (rows ?? []).map((row) => toItem(row, now));
  const upcoming = items
    .filter((item) => item.status.label === "¡Ya se armó!" || item.status.label === "Por confirmar")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  // A player who dropped out and signed up again only sees the current sign-up.
  const upcomingMatches = new Set(upcoming.map((item) => item.matchId));
  const past = items
    .filter((item) => !upcomingMatches.has(item.matchId))
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  const list = history ? past : upcoming;

  const dropping = baja ? upcoming.find((item) => item.matchId === baja && item.canDrop) : undefined;
  const credit = Number(saldo);
  const toasts =
    aviso === "baja"
      ? [
          {
            id: "baja",
            message:
              credit > 0 ? (
                <>
                  Te diste de baja · <strong className="font-semibold">+${credit} de saldo</strong>
                </>
              ) : (
                "Te diste de baja"
              ),
          },
        ]
      : [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-28">
      <h1 className="font-display text-[34px] leading-none font-extrabold tracking-tight">Mis retas</h1>

      <nav aria-label="Mis retas" className="flex rounded-[6px] border border-line bg-surface p-1">
        {TABS.map((item) => {
          const active = (item.key === "historial") === history;
          return (
            <Link
              key={item.label}
              href={item.key ? `/mis-retas?tab=${item.key}` : "/mis-retas"}
              aria-current={active ? "page" : undefined}
              className={`flex h-10 flex-1 items-center justify-center rounded-[6px] text-[15px] font-semibold ${
                active ? "bg-action text-on-action" : "text-muted"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Image src="/mascota/espera.png" alt="" width={140} height={140} />
          <p className="max-w-[260px] text-[15px] text-muted">
            {history ? "Aquí verás las retas que ya jugaste." : "Aún no te inscribes a ninguna reta."}
          </p>
          {!history && (
            <Link
              href="/explorar"
              className="flex h-12 items-center rounded-[6px] bg-action px-6 text-[16px] font-semibold text-on-action"
            >
              Buscar una reta
            </Link>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((item) => (
            <li key={item.registrationId}>
              <MatchCard item={item} now={now} showActions={!history} />
            </li>
          ))}
        </ul>
      )}

      {dropping && (
        <DropOutSheet
          closeHref="/mis-retas"
          info={{
            matchId: dropping.matchId,
            title: dropping.title,
            paidCents: dropping.paidCents,
            active: dropping.active,
            min: dropping.min,
            max: dropping.max,
            confirmed: dropping.confirmed,
          }}
        />
      )}

      {/* Keyed so a redirect back to this same page starts a fresh stack. */}
      <ToastStack key={`${aviso}-${saldo}`} toasts={toasts} clearParams={["aviso", "saldo"]} />
    </main>
  );
}

function MatchCard({ item, now, showActions }: { item: Item; now: Date; showActions: boolean }) {
  return (
    <article className="flex flex-col gap-3 rounded-[6px] border border-line bg-surface p-2.5">
      <div className="relative h-[120px] overflow-hidden rounded-[6px] bg-elevated">
        <Image src={item.cover} alt="" fill sizes="448px" className="object-cover" />
        <span
          className={`absolute top-2.5 left-2.5 rounded-[6px] px-2.5 py-1 text-xs font-semibold ${
            item.status.accent ? "bg-action text-on-action" : "bg-scrim text-white"
          }`}
        >
          {item.status.label}
        </span>
      </div>
      <div className="flex flex-col gap-[3px] px-1.5">
        <span className="font-display text-[21px] leading-none font-extrabold tracking-tight">{item.title}</span>
        <span className="text-[15px] font-semibold">
          {formatDay(item.startsAt, now)} · {formatTime(item.startsAt)} · {item.fieldName}
        </span>
        <span className="text-sm text-muted">{item.note}</span>
      </div>
      <div className="flex gap-2 px-0.5 pb-0.5">
        <Link
          href={`/retas/${item.matchId}`}
          className="flex h-[42px] flex-1 items-center justify-center rounded-[6px] border border-line text-[15px] font-semibold text-ink"
        >
          Ver detalle
        </Link>
        {showActions && item.canDrop && (
          <Link
            href={`/mis-retas?baja=${item.matchId}`}
            scroll={false}
            className="flex h-[42px] flex-1 items-center justify-center rounded-[6px] border border-line text-[15px] font-semibold text-muted"
          >
            Darme de baja
          </Link>
        )}
      </div>
    </article>
  );
}
