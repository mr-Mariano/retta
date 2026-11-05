import Link from "next/link";
import type { Metadata } from "next";
import { formatDay, formatTime } from "@/lib/time";
import { loadOrganizerMatch } from "../match-data";
import { AttendanceList } from "./attendance-list";

export const metadata: Metadata = { title: "Pasar asistencia · Retta" };

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function Asistencia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await loadOrganizerMatch(id);
  const now = new Date();
  const startsAt = new Date(match.slot.starts_at);
  const closes = new Date(startsAt.getTime() + DAY_MS);
  const open = match.status === "confirmed" && startsAt <= now && now < closes;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-10">
      <Link href={`/organizar/${match.id}`} className="flex items-center gap-3 self-start text-[15px] font-semibold text-muted">
        <span className="flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </span>
        La reta
      </Link>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[32px] leading-none font-extrabold tracking-tight">Pasa asistencia</h1>
        <span className="text-[15px] text-muted">
          {match.title ?? `Reta en ${match.slot.field.name}`} · {formatDay(startsAt, now).toLowerCase()} {formatTime(startsAt)}
        </span>
      </div>

      {open ? (
        <>
          <AttendanceList
            players={match.registrations.map((registration) => ({
              id: registration.id,
              name: registration.player.full_name,
              attendance: registration.attendance,
            }))}
          />
          <p className="text-center text-[13px] text-muted">
            Se guarda en cuanto tocas; puedes cambiarla hasta {formatDay(closes, now).toLowerCase()} {formatTime(closes)}. Solo sirve para métricas.
          </p>
        </>
      ) : (
        <p className="text-[15px] text-muted">
          {match.status !== "confirmed"
            ? "Solo se pasa asistencia en retas que se armaron."
            : startsAt > now
              ? `Podrás pasar asistencia cuando empiece, ${formatDay(startsAt, now).toLowerCase()} a las ${formatTime(startsAt)}.`
              : "Ya pasaron las 24 h para pasar asistencia."}
        </p>
      )}
    </main>
  );
}
