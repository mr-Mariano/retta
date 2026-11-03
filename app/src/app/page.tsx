import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TIME_ZONE, formatTime, relativeDay } from "@/lib/time";

interface FeaturedMatch {
  title: string;
  field_name: string;
  starts_at: string;
  active_count: number;
  min_players: number;
  max_players: number;
  status: "pending" | "confirmed";
}

/** "HOY", "MAÑANA" or the short weekday, in Mexico City time. */
function dayLabel(startsAt: Date) {
  return (
    relativeDay(startsAt) ??
    startsAt.toLocaleDateString("es-MX", { timeZone: TIME_ZONE, weekday: "short" }).replace(".", "")
  ).toUpperCase();
}

function headline(match: FeaturedMatch | null) {
  if (!match) return "Encuentra tu reta";
  if (match.status === "pending") {
    const missing = match.min_players - match.active_count;
    return missing === 1 ? "Falta 1 para que se arme" : `Faltan ${missing} para que se arme`;
  }
  const left = match.max_players - match.active_count;
  return left === 1 ? "Ya se armó: queda 1 lugar" : `Ya se armó: quedan ${left} lugares`;
}

export default async function Welcome() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("featured_match");
  const match = (data as FeaturedMatch | null) ?? null;
  const startsAt = match ? new Date(match.starts_at) : null;
  const matchName =
    match && match.title !== `Reta en ${match.field_name}`
      ? `${match.title} · ${match.field_name}`
      : match?.title;

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[520px]">
        <Image src="/fotos/portada.jpg" alt="" fill priority sizes="448px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/20 to-base" />
      </div>

      <div className="relative flex flex-1 flex-col gap-5 px-5 pt-14 pb-8">
        <Image src="/retta-wordmark.svg" alt="Retta" width={59} height={26} priority className="h-[26px] w-auto self-start" />

        {match && startsAt && (
          <div className="mt-[150px] flex items-center gap-3 rounded-[18px] border border-line bg-base/80 p-3 backdrop-blur-sm">
            <span className="flex size-[52px] shrink-0 flex-col items-center justify-center rounded-xl bg-elevated">
              <span className="text-[11px] font-bold text-muted">{dayLabel(startsAt)}</span>
              <span className="font-display text-xl leading-none font-extrabold">
                {formatTime(startsAt)}
              </span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="truncate text-[15px] font-bold">{matchName}</span>
              <span className="flex items-center gap-2">
                <span
                  role="progressbar"
                  aria-label="Lugares ocupados"
                  aria-valuemin={0}
                  aria-valuemax={match.max_players}
                  aria-valuenow={match.active_count}
                  className="relative h-1.5 flex-1 rounded-full bg-line"
                >
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-ink"
                    style={{ width: `${(match.active_count / match.max_players) * 100}%` }}
                  />
                </span>
                <span className="text-[13px] font-semibold text-muted">
                  {match.active_count}/{match.max_players}
                </span>
              </span>
            </span>
          </div>
        )}

        <div className={`flex flex-col gap-2 ${match ? "" : "mt-[230px]"}`}>
          <h1 className="font-display text-5xl leading-[0.92] font-extrabold">{headline(match)}</h1>
          <p className="text-[15px] leading-normal text-muted">
            {match ? "Únete en un minuto y aparta tu lugar." : "Inscríbete solo, sin armar equipo. Paga y juega."}
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-2.5">
          <Link
            href="/registro"
            className="flex h-[52px] items-center justify-center rounded-full bg-action text-[16px] font-bold text-on-action"
          >
            Crear cuenta
          </Link>
          <p className="text-center text-[15px] text-muted">
            ¿Ya tienes cuenta?{" "}
            <Link href="/entrar" className="font-semibold text-ink">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
