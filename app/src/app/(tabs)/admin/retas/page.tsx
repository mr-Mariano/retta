import Link from "next/link";
import type { Metadata } from "next";
import { Sheet } from "@/components/sheet";
import { ToastStack } from "@/components/toast-stack";
import { requireRole } from "@/lib/roles";
import { dayKey, formatDay, formatTime } from "@/lib/time";
import { cancelMatchAsAdmin } from "@/app/admin/actions";

export const metadata: Metadata = { title: "Retas · Retta" };

const NOTICES: Record<string, string> = {
  cancelada: "Reta cancelada",
  error: "No se pudo cancelar la reta",
};

interface MatchRow {
  id: string;
  title: string | null;
  status: "pending" | "confirmed" | "cancelled";
  min_players: number;
  max_players: number;
  slot: { starts_at: string; field: { name: string } };
  registrations: { count: number }[];
}

/**
 * Admin matches, flow B (2026-11-04): upcoming matches grouped by day with a dot
 * for pending ones; tapping one opens a sheet with only "Cancelar reta" and an
 * optional reason.
 */
export default async function AdminRetas({ searchParams }: { searchParams: Promise<{ reta?: string; aviso?: string }> }) {
  const [{ supabase }, { reta, aviso }] = await Promise.all([requireRole(["admin"]), searchParams]);
  const now = new Date();
  const { data } = await supabase
    .from("matches")
    .select("id, title, status, min_players, max_players, slot:slots!inner(starts_at, field:fields!inner(name)), registrations(count)")
    .neq("status", "cancelled")
    .gt("slot.starts_at", now.toISOString())
    .eq("registrations.status", "active")
    .returns<MatchRow[]>();
  const matches = (data ?? []).sort((a, b) => a.slot.starts_at.localeCompare(b.slot.starts_at));

  const days = new Map<string, MatchRow[]>();
  for (const match of matches) {
    const key = dayKey(new Date(match.slot.starts_at));
    days.set(key, [...(days.get(key) ?? []), match]);
  }
  const selected = reta ? matches.find((m) => m.id === reta) : undefined;
  const name = (m: MatchRow) => m.title ?? `Reta en ${m.slot.field.name}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-32">
      <h1 className="font-display text-[34px] leading-none font-medium">Retas</h1>

      {matches.length === 0 ? (
        <p className="py-8 text-center text-[15px] text-muted">No hay retas próximas.</p>
      ) : (
        [...days.values()].map((list) => (
          <section key={list[0]!.id} className="flex flex-col">
            <h2 className="text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">{formatDay(new Date(list[0]!.slot.starts_at), now)}</h2>
            <ul className="flex flex-col">
              {list.map((match) => {
                const active = match.registrations[0]?.count ?? 0;
                return (
                  <li key={match.id}>
                    <Link href={`/admin/retas?reta=${match.id}`} scroll={false} className="flex items-center gap-3 border-b border-line py-3">
                      <span className="w-12 font-display text-[19px] font-medium">{formatTime(new Date(match.slot.starts_at))}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[16px] font-semibold">{name(match)}</span>
                        <span className="text-[13px] text-muted">
                          {match.slot.field.name} · {active}/{match.max_players}
                        </span>
                      </span>
                      {match.status === "pending" && <span aria-label="Pendiente" className="size-2 rounded-full bg-action" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {selected && (
        <Sheet title={name(selected)} closeHref="/admin/retas">
          <p className="-mt-2 text-[15px] text-muted">
            {formatDay(new Date(selected.slot.starts_at), now)} {formatTime(new Date(selected.slot.starts_at))} · {selected.slot.field.name} ·{" "}
            {selected.registrations[0]?.count ?? 0} inscritos
          </p>
          <form action={cancelMatchAsAdmin.bind(null, selected.id)} className="flex flex-col gap-3">
            <details className="group">
              <summary className="cursor-pointer list-none text-[15px] font-semibold text-action [&::-webkit-details-marker]:hidden">
                Agregar motivo
              </summary>
              <textarea
                name="note"
                rows={3}
                maxLength={200}
                placeholder="Lo verán los inscritos"
                aria-label="Motivo de la cancelación"
                className="mt-2 w-full rounded-2xl border border-line bg-elevated px-4 py-3 text-[16px] placeholder:text-muted focus:border-action focus:outline-none"
              />
            </details>
            <button type="submit" className="h-[52px] rounded-full bg-danger text-[17px] font-semibold text-[#1a0805]">
              Cancelar reta
            </button>
          </form>
        </Sheet>
      )}
      <ToastStack key={aviso} toasts={aviso && NOTICES[aviso] ? [{ id: aviso, message: NOTICES[aviso] }] : []} clearParams={["aviso"]} />
    </main>
  );
}
