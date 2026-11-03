"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "@/lib/location";
import { MAPBOX_TOKEN, fetchTravelTimes, formatDistance, formatDuration } from "@/lib/mapbox";
import { MatchCard, type Match } from "./match-card";

type SerializedMatch = Omit<Match, "startsAt"> & { startsAt: string };
type Travel = { seconds: number; meters: number } | null;

/** "Cerca de mí" (session 7): sorts by driving time from the player and shows it on each match. */
export function NearMeList({ matches }: { matches: SerializedMatch[] }) {
  const { state, locate } = useLocation();
  const [times, setTimes] = useState<Map<string, Travel> | null>(null);
  const [failed, setFailed] = useState(false);
  const now = useMemo(() => new Date(), []);
  const userCoords = state.status === "ready" ? state.coords : null;

  useEffect(() => {
    if (!userCoords || !MAPBOX_TOKEN) return;
    // One Matrix call per distinct field; many matches share a field.
    const fields = new Map<string, { lat: number; lng: number }>();
    for (const match of matches) if (match.coords) fields.set(`${match.coords.lat},${match.coords.lng}`, match.coords);
    const keys = [...fields.keys()];
    fetchTravelTimes(userCoords, [...fields.values()])
      .then((results) => setTimes(new Map(keys.map((key, i) => [key, results[i]]))))
      .catch(() => setFailed(true));
  }, [userCoords, matches]);

  // Without travel times the list stays in date order under the notice.
  const byDate = (notice: React.ReactNode) => (
    <>
      {notice}
      <MatchList matches={matches} now={now} />
    </>
  );

  if (!MAPBOX_TOKEN) return byDate(<Notice text="Por ahora no podemos calcular distancias." />);

  if (state.status === "prompt" || state.status === "declined") {
    return byDate(
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <span className="text-[16px] font-semibold">¿Qué retas te quedan más cerca?</span>
        <span className="text-sm leading-snug text-muted">
          Usa tu ubicación para ordenarlas por tiempo en auto. Solo la usamos en tu teléfono; no la guardamos.
        </span>
        <button
          type="button"
          onClick={locate}
          className="flex h-12 items-center justify-center rounded-full bg-action text-[16px] font-semibold text-on-action"
        >
          Usar mi ubicación
        </button>
      </div>,
    );
  }
  if (state.status === "denied") {
    return byDate(<Notice text="Sin permiso de ubicación. Actívalo en tu navegador para ver las retas más cercanas." />);
  }
  if (state.status === "unavailable" || failed) {
    return byDate(<Notice text="No pudimos calcular las distancias. Inténtalo de nuevo en un momento." />);
  }
  if (!times) return <Notice text="Calculando tiempos…" live />;

  const travelFor = (match: SerializedMatch) => (match.coords ? times.get(`${match.coords.lat},${match.coords.lng}`) ?? null : null);
  const sorted = [...matches].sort((a, b) => (travelFor(a)?.seconds ?? Infinity) - (travelFor(b)?.seconds ?? Infinity));

  return (
    <>
      <p className="-mt-3 text-[13px] text-muted">Ordenadas por tiempo en auto desde tu ubicación</p>
      <MatchList
        matches={sorted}
        now={now}
        detailFor={(match) => {
          const travel = travelFor(match);
          return travel ? `${formatDuration(travel.seconds)} · ${formatDistance(travel.meters)}` : undefined;
        }}
      />
    </>
  );
}

function MatchList({
  matches,
  now,
  detailFor,
}: {
  matches: SerializedMatch[];
  now: Date;
  detailFor?: (match: SerializedMatch) => string | undefined;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {matches.map((match) => (
        <li key={match.id}>
          <MatchCard match={{ ...match, startsAt: new Date(match.startsAt) }} now={now} detail={detailFor?.(match)} />
        </li>
      ))}
    </ul>
  );
}

function Notice({ text, live }: { text: string; live?: boolean }) {
  return (
    <p aria-live={live ? "polite" : undefined} className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
      {text}
    </p>
  );
}
