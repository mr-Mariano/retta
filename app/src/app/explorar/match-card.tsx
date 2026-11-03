import Image from "next/image";
import Link from "next/link";
import type { Coords } from "@/lib/location";
import { formatDay, formatTime } from "@/lib/time";

export interface Match {
  id: string;
  title: string;
  fieldName: string;
  cover: string;
  startsAt: Date;
  price: string;
  isFree: boolean;
  active: number;
  min: number;
  max: number;
  pending: boolean;
  coords: Coords | null;
}

/** A match row in Explore. `detail` replaces the field line (e.g. travel time in "Cerca de mí"). */
export function MatchCard({ match, now, detail }: { match: Match; now: Date; detail?: string }) {
  const full = match.active >= match.max;
  const content = (
    <>
      <span className="relative size-[84px] shrink-0 overflow-hidden rounded-xl bg-elevated">
        <Image src={match.cover} alt="" fill sizes="84px" className="object-cover" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="truncate text-[16px] font-bold">{match.title}</span>
        <span className="text-sm font-semibold">
          {formatDay(match.startsAt, now)} · {formatTime(match.startsAt)}
        </span>
        <span className="truncate text-[13px] text-muted">{detail ?? match.fieldName}</span>
      </span>
      <span className="flex flex-col items-end gap-1.5 pr-1.5">
        <span className="font-display text-[20px] leading-none font-medium">{match.price}</span>
        <span className="rounded-full bg-elevated px-[7px] py-0.5 text-[11px] font-semibold text-muted">
          {full ? "Llena" : `${match.active}/${match.max}`}
        </span>
      </span>
    </>
  );
  const className = "flex items-center gap-3 rounded-[18px] border border-line bg-surface p-2 text-ink";

  // Full matches stay visible but cannot be opened (session 5).
  if (full) {
    return (
      <div aria-disabled="true" className={`${className} opacity-55`}>
        {content}
      </div>
    );
  }
  return (
    <Link href={`/retas/${match.id}`} className={className}>
      {content}
    </Link>
  );
}
