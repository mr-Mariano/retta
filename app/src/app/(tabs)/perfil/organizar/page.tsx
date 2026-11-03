import Link from "next/link";
import type { Metadata } from "next";
import { CapacityDots } from "@/components/capacity-dots";
import { ToastStack } from "@/components/toast-stack";
import { requireRole } from "@/lib/roles";
import { formatDay, formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Tus retas · Retta" };

const DAY_MS = 24 * 60 * 60 * 1000;

interface OrganizedRow {
  id: string;
  title: string | null;
  status: "pending" | "confirmed" | "cancelled";
  min_players: number;
  max_players: number;
  confirmation_deadline: string;
  slot: { starts_at: string; ends_at: string; field: { name: string } };
  registrations: { count: number }[];
}

/** Status first (organizer card variant 4): what the organizer should know at a glance. */
function describe(row: OrganizedRow, now: Date) {
  const startsAt = new Date(row.slot.starts_at);
  const active = row.registrations[0]?.count ?? 0;
  const minutes = Math.round((now.getTime() - startsAt.getTime()) / 60000);

  if (row.status === "cancelled") return { status: "Cancelada", accent: false, attendance: false };
  if (minutes >= 0) {
    const attendance = row.status === "confirmed" && minutes < 24 * 60;
    const status =
      row.status !== "confirmed"
        ? "No se armó"
        : minutes < 90
          ? `En juego · empezó hace ${minutes} min`
          : attendance
            ? "Terminó · pasa asistencia"
            : "Jugada";
    return { status, accent: attendance, attendance };
  }
  if (active === 0) return { status: "Sin inscritos aún", accent: false, attendance: false };
  if (active >= row.max_players) return { status: "Llena", accent: true, attendance: false };
  if (row.status === "pending") {
    const missing = row.min_players - active;
    return { status: missing === 1 ? "Falta 1 para que se arme" : `Faltan ${missing} para que se arme`, accent: true, attendance: false };
  }
  const left = row.max_players - active;
  return { status: `Ya se armó · ${left === 1 ? "queda 1 lugar" : `quedan ${left} lugares`}`, accent: true, attendance: false };
}

export default async function Organizar({ searchParams }: { searchParams: Promise<{ tab?: string; aviso?: string }> }) {
  const { tab, aviso } = await searchParams;
  const past = tab === "pasadas";
  const { supabase, user } = await requireRole(["organizer", "admin"]);
  const now = new Date();

  const { data: rows } = await supabase
    .from("matches")
    .select("id, title, status, min_players, max_players, confirmation_deadline, slot:slots!inner(starts_at, ends_at, field:fields!inner(name)), registrations(count)")
    .eq("organizer_id", user.id)
    .eq("registrations.status", "active")
    .returns<OrganizedRow[]>();

  // A match stays under "Próximas" until its attendance window closes, 24 h after it starts.
  const isPast = (row: OrganizedRow) => row.status === "cancelled" || new Date(row.slot.starts_at).getTime() + DAY_MS <= now.getTime();
  const list = (rows ?? [])
    .filter((row) => isPast(row) === past)
    .sort((a, b) => (past ? -1 : 1) * (new Date(a.slot.starts_at).getTime() - new Date(b.slot.starts_at).getTime()));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-28">
      <Link href="/perfil" className="flex items-center gap-3 self-start text-[15px] font-semibold text-muted">
        <span className="flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </span>
        Perfil
      </Link>

      <div className="flex items-end justify-between">
        <h1 className="font-display text-[34px] leading-none font-medium">Tus retas</h1>
        <Link href="/organizar/nueva" className="flex h-10 items-center gap-1.5 rounded-full bg-action px-3.5 text-[15px] font-semibold text-on-action">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Crear reta
        </Link>
      </div>

      <nav aria-label="Tus retas" className="flex rounded-full border border-line bg-surface p-1">
        {[
          { href: "/perfil/organizar", label: "Próximas", active: !past },
          { href: "/perfil/organizar?tab=pasadas", label: "Pasadas", active: past },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`flex h-[38px] flex-1 items-center justify-center rounded-full text-[15px] font-semibold ${item.active ? "bg-action text-on-action" : "text-muted"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-muted">
          {past ? "Aquí verás tus retas jugadas y canceladas." : "Aún no tienes retas. Crea la primera."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((row) => {
            const info = describe(row, now);
            const startsAt = new Date(row.slot.starts_at);
            const active = row.registrations[0]?.count ?? 0;
            return (
              <li key={row.id}>
                <Link href={`/organizar/${row.id}`} className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-3.5 text-ink">
                  <span className={`text-[15px] font-semibold ${info.accent ? "text-action" : "text-muted"}`}>{info.status}</span>
                  <span className="font-display text-[24px] leading-none font-medium">{row.title ?? `Reta en ${row.slot.field.name}`}</span>
                  <span className="text-sm text-muted">
                    {formatDay(startsAt, now)} {formatTime(startsAt)} · {row.slot.field.name} · {active} de {row.max_players}
                  </span>
                  {row.status !== "cancelled" && <CapacityDots active={active} min={row.min_players} max={row.max_players} size="sm" />}
                </Link>
                {info.attendance && (
                  <Link
                    href={`/organizar/${row.id}/asistencia`}
                    className="mt-2 flex h-10 items-center justify-center gap-1.5 rounded-full bg-action text-[15px] font-semibold text-on-action"
                  >
                    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    Pasar asistencia
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ToastStack
        key={aviso}
        toasts={aviso === "cancelada" ? [{ id: "cancelada", message: "Reta cancelada · los inscritos recibieron su saldo" }] : []}
        clearParams={["aviso"]}
      />
    </main>
  );
}
