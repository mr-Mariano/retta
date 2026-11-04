import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { coverSrc } from "@/lib/covers";

/** Notices from the agent and from the matches a player joined (in-app inbox). */

export type NoticeKind = "invite" | "reactivation" | "match_confirmed" | "match_cancelled" | "match_moved";

interface NoticeRow {
  id: string;
  kind: NoticeKind;
  data: { reason?: string; credit_cents?: number; last_played_at?: string | null; to_starts_at?: string; rescued?: boolean };
  created_at: string;
  read_at: string | null;
  match: {
    id: string;
    title: string | null;
    status: "pending" | "confirmed" | "cancelled";
    min_players: number;
    max_players: number;
    price_cents: number;
    confirmation_deadline: string;
    slot: { starts_at: string; field: { name: string; area: string | null; cover_image: string } };
    registrations: { count: number }[];
  } | null;
}

export interface NoticeMatch {
  id: string;
  title: string;
  fieldName: string;
  cover: string;
  startsAt: string;
  deadline: string;
  pending: boolean;
  active: number;
  min: number;
  max: number;
  pricePesos: number;
}

export interface Notice {
  id: string;
  kind: NoticeKind;
  createdAt: string;
  unread: boolean;
  reason?: string;
  creditCents?: number;
  lastPlayedAt?: string | null;
  match: NoticeMatch | null;
  /** The match still takes this player: not started, not closed, not full, not joined. */
  open: boolean;
  joined: boolean;
}

export async function loadNotices(supabase: SupabaseClient, userId: string, limit = 30): Promise<Notice[]> {
  const [{ data: rows }, { data: mine }] = await Promise.all([
    supabase
      .from("notices")
      .select(
        "id, kind, data, created_at, read_at, match:matches(id, title, status, min_players, max_players, price_cents, confirmation_deadline, slot:slots!inner(starts_at, field:fields!inner(name, area, cover_image)), registrations(count))",
      )
      .eq("user_id", userId)
      .is("dismissed_at", null)
      .eq("match.registrations.status", "active")
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<NoticeRow[]>(),
    supabase.from("registrations").select("match_id").eq("player_id", userId).eq("status", "active"),
  ]);
  const joined = new Set((mine ?? []).map((row) => row.match_id as string));
  const now = Date.now();

  return (rows ?? []).map((row) => {
    const m = row.match;
    const match: NoticeMatch | null = m
      ? {
          id: m.id,
          title: m.title ?? `Reta en ${m.slot.field.name}`,
          fieldName: m.slot.field.area ?? m.slot.field.name,
          cover: coverSrc(m.slot.field.cover_image),
          startsAt: m.slot.starts_at,
          deadline: m.confirmation_deadline,
          pending: m.status === "pending",
          active: m.registrations[0]?.count ?? 0,
          min: m.min_players,
          max: m.max_players,
          pricePesos: m.price_cents / 100,
        }
      : null;
    const isJoined = !!m && joined.has(m.id);
    const open =
      !!m &&
      m.status !== "cancelled" &&
      new Date(m.slot.starts_at).getTime() > now &&
      !(m.status === "pending" && new Date(m.confirmation_deadline).getTime() <= now) &&
      (m.registrations[0]?.count ?? 0) < m.max_players &&
      !isJoined;
    return {
      id: row.id,
      kind: row.kind,
      createdAt: row.created_at,
      unread: row.read_at === null,
      reason: row.data.reason,
      creditCents: row.data.credit_cents,
      lastPlayedAt: row.data.last_played_at,
      match,
      open,
      joined: isJoined,
    };
  });
}

/** Where "Unirme" / "Me apunto" goes: the payment sheet, or the detail for free matches. */
export function joinHref(match: NoticeMatch) {
  return match.pricePesos > 0 ? `/retas/${match.id}?pago=1` : `/retas/${match.id}`;
}
