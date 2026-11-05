import Image from "next/image";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { TIME_ZONE, formatTime, relativeDay } from "@/lib/time";

export interface FeaturedMatch {
  title: string;
  field_name: string;
  starts_at: string;
  active_count: number;
  min_players: number;
  max_players: number;
  status: "pending" | "confirmed";
}

export async function loadFeaturedMatch() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("featured_match");
  return (data as FeaturedMatch | null) ?? null;
}

/** "HOY", "MAÑANA" or the short weekday, in Mexico City time. */
function dayLabel(startsAt: Date) {
  return (
    relativeDay(startsAt) ??
    startsAt.toLocaleDateString("es-MX", { timeZone: TIME_ZONE, weekday: "short" }).replace(".", "")
  ).toUpperCase();
}

export function headline(match: FeaturedMatch | null) {
  if (!match) return "Encuentra tu reta";
  if (match.status === "pending") {
    const missing = match.min_players - match.active_count;
    return missing === 1 ? "Falta 1 para que se arme" : `Faltan ${missing} para que se arme`;
  }
  const left = match.max_players - match.active_count;
  return left === 1 ? "Ya se armó: queda 1 lugar" : `Ya se armó: quedan ${left} lugares`;
}

/** The featured match as a small live card: day, time, name and how full it is. */
export function LiveMatchCard({ match }: { match: FeaturedMatch }) {
  const startsAt = new Date(match.starts_at);
  const name = match.title !== `Reta en ${match.field_name}` ? `${match.title} · ${match.field_name}` : match.title;
  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-line bg-base/80 p-3 backdrop-blur-sm">
      <span className="flex size-[52px] shrink-0 flex-col items-center justify-center rounded-xl bg-elevated">
        <span className="text-[11px] font-bold text-muted">{dayLabel(startsAt)}</span>
        <span className="font-display text-[18px] leading-none font-medium">{formatTime(startsAt)}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-[15px] font-bold text-ink">{name}</span>
        <span className="flex items-center gap-2">
          <span
            role="progressbar"
            aria-label="Lugares ocupados"
            aria-valuemin={0}
            aria-valuemax={match.max_players}
            aria-valuenow={match.active_count}
            className="relative h-1.5 flex-1 rounded-full bg-line"
          >
            <span className="absolute inset-y-0 left-0 rounded-full bg-action" style={{ width: `${(match.active_count / match.max_players) * 100}%` }} />
          </span>
          <span className="text-[13px] font-semibold text-muted">
            {match.active_count}/{match.max_players}
          </span>
        </span>
      </span>
    </div>
  );
}

/**
 * Signed-out screens on desktop (welcome A, 2026-11-05): the photo with the
 * live match on the left half, the screen's own content on the right. On
 * phones only the content renders, unchanged.
 */
export async function AuthSplit({ children }: { children: ReactNode }) {
  const match = await loadFeaturedMatch();
  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[minmax(0,1fr)_480px]">
      <section className="relative hidden overflow-hidden lg:block">
        <Image src="/fotos/portada.jpg" alt="" fill priority sizes="60vw" className="object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(10_10_10/0.25),rgb(10_10_10/0.85))]" />
        <Image src="/retta-wordmark.svg" alt="Retta" width={73} height={32} className="absolute top-10 left-12 h-8 w-auto" />
        <div className="absolute inset-x-12 bottom-14 flex max-w-[560px] flex-col gap-[22px] text-white">
          {match && (
            <div className="w-[440px]">
              <LiveMatchCard match={match} />
            </div>
          )}
          <h2 className="font-display text-[56px] leading-none font-medium">{headline(match)}</h2>
          <p className="text-[18px] opacity-85">Encuentra una reta cerca y únete solo, en un minuto.</p>
        </div>
      </section>
      <div className="lg:flex lg:flex-col lg:justify-center lg:px-8 lg:[&>main]:min-h-0">{children}</div>
    </div>
  );
}
