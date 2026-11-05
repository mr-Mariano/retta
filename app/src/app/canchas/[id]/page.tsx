import Link from "next/link";
import type { Metadata } from "next";
import { ToastStack } from "@/components/toast-stack";
import { dayKey, formatLongDay, formatTime, mxDate, TIME_ZONE } from "@/lib/time";
import { removeSlot } from "../actions";
import { loadManagedField } from "../field-data";

export const metadata: Metadata = { title: "Agenda de la cancha · Retta" };

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS = 14;

interface SlotRow {
  id: string;
  starts_at: string;
  ends_at: string;
  matches: {
    status: string;
    title: string | null;
    max_players: number;
    organizer: { full_name: string };
    registrations: { count: number }[];
  }[];
}

const NOTICES: Record<string, (n?: string) => string> = {
  publicados: (n) => (n === "0" ? "No había horarios nuevos: ya existían" : `Publicamos ${n} horario${n === "1" ? "" : "s"}`),
  quitado: () => "Horario quitado",
  "no-quitado": () => "No se pudo quitar: ese horario tiene una reta",
};

export default async function Agenda({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dia?: string; quitar?: string; aviso?: string; n?: string }>;
}) {
  const [{ id }, { dia, quitar, aviso, n }] = await Promise.all([params, searchParams]);
  const { supabase, field } = await loadManagedField(id);
  const now = new Date();
  const days = Array.from({ length: DAYS }, (_, i) => dayKey(new Date(now.getTime() + i * DAY_MS)));
  const day = dia && days.includes(dia) ? dia : days[0]!;

  const { data: slots } = await supabase
    .from("slots")
    .select("id, starts_at, ends_at, matches(status, title, max_players, organizer:profiles!matches_organizer_id_fkey(full_name), registrations(count))")
    .eq("field_id", field.id)
    .gte("starts_at", new Date(Math.max(now.getTime(), mxDate(days[0]!, "00:00").getTime())).toISOString())
    .lt("starts_at", mxDate(days.at(-1)!, "23:59").toISOString())
    .eq("matches.registrations.status", "active")
    .order("starts_at")
    .returns<SlotRow[]>();

  const all = slots ?? [];
  const daysWithSlots = new Set(all.map((slot) => dayKey(new Date(slot.starts_at))));
  const today = all.filter((slot) => dayKey(new Date(slot.starts_at)) === day);
  const matchOf = (slot: SlotRow) => slot.matches.find((m) => m.status !== "cancelled");
  const booked = today.filter((slot) => matchOf(slot)).length;
  const removing = quitar ? today.find((slot) => slot.id === quitar && !matchOf(slot)) : undefined;
  const label = (key: string, opts: Intl.DateTimeFormatOptions) =>
    mxDate(key, "12:00").toLocaleDateString("es-MX", { timeZone: TIME_ZONE, ...opts }).replace(".", "");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-32">
      <Link href="/perfil/canchas" className="flex items-center gap-3 self-start text-[15px] font-semibold text-muted">
        <span className="flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </span>
        Tus canchas
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[30px] leading-none font-extrabold tracking-tight">{field.name}</h1>
        {field.area && <span className="text-sm text-muted">{field.area}</span>}
      </div>

      <nav aria-label="Día" className="-mr-4 flex gap-1.5 overflow-x-auto pr-4 [scrollbar-width:none]">
        {days.map((key) => {
          const selected = key === day;
          return (
            <Link
              key={key}
              href={`/canchas/${field.id}?dia=${key}`}
              scroll={false}
              aria-current={selected ? "date" : undefined}
              className={`flex h-14 w-[46px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl ${selected ? "bg-action text-on-action" : "border border-line bg-surface text-ink"}`}
            >
              <span className="text-[10px] font-semibold uppercase opacity-80">{label(key, { weekday: "short" })}</span>
              <span className="text-[17px] leading-tight font-medium">{label(key, { day: "numeric" })}</span>
              <span aria-hidden="true" className={`size-1 rounded-full ${daysWithSlots.has(key) ? (selected ? "bg-on-action" : "bg-action") : ""}`} />
            </Link>
          );
        })}
      </nav>

      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[21px] font-extrabold tracking-tight">{formatLongDay(mxDate(day, "12:00"))}</h2>
        {today.length > 0 && (
          <span className="text-sm text-muted">
            {today.length - booked} libres · {booked} con reta
          </span>
        )}
      </div>

      {today.length === 0 ? (
        <p className="-mt-2 text-[15px] text-muted">No hay horarios este día.</p>
      ) : (
        <ul className="-mt-2 flex flex-col gap-2">
          {today.map((slot) => {
            const match = matchOf(slot);
            return (
              <li
                key={slot.id}
                className={`flex items-center gap-3 rounded-[6px] px-3 py-2.5 ${match ? "border border-line bg-surface" : "border border-dashed border-line"}`}
              >
                <span className="flex w-[54px] flex-col">
                  <span className="text-[18px] font-medium">{formatTime(new Date(slot.starts_at))}</span>
                  <span className="text-xs text-muted">a {formatTime(new Date(slot.ends_at))}</span>
                </span>
                {match ? (
                  <>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-semibold">{match.title ?? `Reta en ${field.name}`}</span>
                      <span className="text-[13px] text-muted">
                        {match.organizer.full_name} · {match.registrations[0]?.count ?? 0} de {match.max_players}
                      </span>
                    </span>
                    <span className="rounded-[6px] bg-elevated px-2 py-[3px] text-xs font-semibold">Con reta</span>
                  </>
                ) : (
                  <>
                    <span className="flex flex-1 flex-col">
                      <span className="text-[15px] font-semibold text-action">Libre</span>
                      <span className="text-[13px] text-muted">Disponible para organizadores</span>
                    </span>
                    <Link
                      href={`/canchas/${field.id}?dia=${day}&quitar=${slot.id}`}
                      scroll={false}
                      aria-label={`Quitar horario de las ${formatTime(new Date(slot.starts_at))}`}
                      className="flex size-10 items-center justify-center rounded-full border border-line text-muted"
                    >
                      <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                      </svg>
                    </Link>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[13px] text-muted">Solo puedes quitar horarios libres. Si una reta se cancela, su horario vuelve a quedar libre.</p>

      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md bg-gradient-to-t from-base from-60% px-4 pt-6 pb-8">
        <Link
          href={`/canchas/${field.id}/publicar`}
          className="flex h-[52px] items-center justify-center gap-2 rounded-[6px] bg-action text-[17px] font-semibold text-on-action"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Publicar horarios
        </Link>
      </div>

      {removing && (
        <div className="fixed inset-0 z-30 mx-auto max-w-md">
          <Link href={`/canchas/${field.id}?dia=${day}`} scroll={false} aria-label="Cerrar" className="absolute inset-0 animate-fade-in bg-black/60" />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="quitar-titulo"
            className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] animate-sheet-up flex-col gap-4 overflow-y-auto rounded-t-[10px] border-t border-line bg-surface px-5 pt-3 pb-8"
          >
            <span aria-hidden="true" className="h-[5px] w-10 self-center rounded-[6px] bg-line" />
            <div className="flex flex-col gap-1">
              <h2 id="quitar-titulo" className="font-display text-[28px] leading-none font-extrabold tracking-tight">
                ¿Quitar este horario?
              </h2>
              <span className="text-[15px] text-muted">
                {field.name} · {formatLongDay(new Date(removing.starts_at)).toLowerCase()} · {formatTime(new Date(removing.starts_at))} a{" "}
                {formatTime(new Date(removing.ends_at))}
              </span>
            </div>
            <p className="text-[15px] leading-[1.45]">
              Los organizadores ya no podrán crear una reta en este horario. Puedes volver a publicarlo cuando quieras.
            </p>
            <form action={removeSlot.bind(null, field.id, removing.id, day)}>
              <button type="submit" className="h-[52px] w-full rounded-[6px] bg-danger text-[17px] font-semibold text-[#1a0805]">
                Quitar horario
              </button>
            </form>
            <Link href={`/canchas/${field.id}?dia=${day}`} scroll={false} className="flex h-12 items-center justify-center rounded-[6px] border border-line text-[16px] font-semibold text-ink">
              Mejor no
            </Link>
          </section>
        </div>
      )}

      <ToastStack key={`${aviso}-${n}`} toasts={aviso && NOTICES[aviso] ? [{ id: aviso, message: NOTICES[aviso](n) }] : []} clearParams={["aviso", "n"]} />
    </main>
  );
}
