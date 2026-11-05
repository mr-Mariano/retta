"use server";

import { coverSrc } from "@/lib/covers";
import { describe, followUps, reply, searchOrRelax, understand, type Criteria, type SearchMatch } from "@/lib/agent/search";
import { createClient } from "@/lib/supabase/server";

export interface ChatAnswer {
  criteria: Criteria;
  steps: string[];
  text: string;
  matches: SearchMatch[];
  chips: string[];
}

interface Row {
  id: string;
  title: string | null;
  price_cents: number;
  min_players: number;
  max_players: number;
  status: "pending" | "confirmed";
  confirmation_deadline: string;
  format: "fut5" | "fut7" | "fut11";
  level: "beginner" | "intermediate" | "advanced";
  type: "men" | "women" | "mixed";
  slot: { starts_at: string; field: { name: string; area: string | null; cover_image: string } };
  registrations: { count: number }[];
}

/** One turn of the desktop chat: understand the message, search open matches, answer. */
export async function askAgent(message: string, previous: Criteria | null): Promise<ChatAnswer> {
  const text = message.trim().slice(0, 300);
  const supabase = await createClient();
  const now = new Date();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Matches the person already joined are not suggested again.
  const { data: mine } = user
    ? await supabase.from("registrations").select("match_id").eq("player_id", user.id).eq("status", "active")
    : { data: [] };
  const joined = new Set((mine ?? []).map((row) => row.match_id as string));
  const { data } = await supabase
    .from("matches")
    .select(
      "id, title, price_cents, min_players, max_players, status, confirmation_deadline, format, level, type, slot:slots!inner(starts_at, field:fields!inner(name, area, cover_image)), registrations(count)",
    )
    .neq("status", "cancelled")
    .gt("slots.starts_at", now.toISOString())
    .eq("registrations.status", "active")
    .returns<Row[]>();

  const all: SearchMatch[] = (data ?? [])
    .filter((row) => !joined.has(row.id) && !(row.status === "pending" && new Date(row.confirmation_deadline) <= now))
    .map((row) => ({
      id: row.id,
      title: row.title ?? `Reta en ${row.slot.field.name}`,
      fieldName: row.slot.field.name,
      area: row.slot.field.area,
      cover: coverSrc(row.slot.field.cover_image),
      startsAt: row.slot.starts_at,
      pricePesos: row.price_cents / 100,
      active: row.registrations[0]?.count ?? 0,
      min: row.min_players,
      max: row.max_players,
      pending: row.status === "pending",
      format: row.format,
      level: row.level,
      type: row.type,
    }));
  const places = [...new Set(all.flatMap((m) => [m.fieldName, m.area].filter((p): p is string => Boolean(p))))];

  const { criteria } = await understand(text, previous, places, now);
  const { found, relaxed } = searchOrRelax(all, criteria, now);
  return { criteria, steps: describe(criteria, now), text: reply(found, criteria, now, relaxed), matches: found, chips: followUps(criteria) };
}
