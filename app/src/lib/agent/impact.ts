export interface ImpactFacts {
  outcomes: (string | null)[];
  matches: {
    startsAt: string;
    endsAt: string;
    active: number;
    present: number;
    returning: string[];
  }[];
}

export interface ImpactRepository {
  factsSince(since: Date): Promise<ImpactFacts>;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function loadImpact(repository: ImpactRepository, now: Date) {
  const { outcomes, matches } = await repository.factsSince(new Date(now.getTime() - WEEK_MS));
  const returning = new Set<string>();
  let played = 0;
  let scheduled = 0;
  for (const match of matches) {
    const start = Date.parse(match.startsAt);
    const duration = (Date.parse(match.endsAt) - start) / 60_000;
    if (start > now.getTime()) {
      scheduled += match.active * duration;
    } else {
      played += match.present * duration;
      match.returning.forEach((player) => returning.add(player));
    }
  }
  return {
    saved: outcomes.filter((outcome) => outcome === "rescued").length,
    notRescued: outcomes.filter((outcome) => outcome === "not_rescued").length,
    returning: returning.size,
    played,
    scheduled,
  };
}
