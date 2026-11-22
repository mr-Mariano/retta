import "server-only";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/roles";

export interface OrganizerMatch {
  id: string;
  title: string | null;
  status: "pending" | "confirmed" | "cancelled";
  min_players: number;
  max_players: number;
  confirmation_deadline: string;
  organizer_id: string;
  agent_enabled: boolean;
  slot: { starts_at: string; ends_at: string; field: { name: string } };
  registrations: {
    id: string;
    created_at: string;
    attendance: "unrecorded" | "present" | "absent";
    player: { full_name: string; phone: string | null };
  }[];
}

/** The match with its active sign-ups, only for its organizer (or an admin). */
export async function loadOrganizerMatch(id: string) {
  const { supabase, user, role } = await requireRole(["player", "admin"]);
  const { data: match } = await supabase
    .from("matches")
    .select(
      "id, title, status, min_players, max_players, confirmation_deadline, organizer_id, agent_enabled, slot:slots!inner(starts_at, ends_at, field:fields!inner(name)), registrations(id, created_at, attendance, player:profiles!registrations_player_id_fkey(full_name))",
    )
    .eq("id", id)
    .eq("registrations.status", "active")
    .order("created_at", { referencedTable: "registrations" })
    .returns<(Omit<OrganizerMatch, "registrations"> & {
      registrations: (Omit<OrganizerMatch["registrations"][number], "player"> & { player: { full_name: string } })[];
    })[]>()
    .maybeSingle();
  if (!match || (match.organizer_id !== user.id && role !== "admin")) notFound();
  const { data: contacts } = match.organizer_id === user.id
    ? await supabase.rpc("organizer_match_phones", { p_match_id: id })
    : { data: [] };
  const phones = new Map<string, string | null>();
  for (const contact of Array.isArray(contacts) ? contacts : []) {
    phones.set(contact.registration_id, contact.phone);
  }
  return {
    ...match,
    registrations: match.registrations.map((registration) => ({
      ...registration,
      player: { ...registration.player, phone: phones.get(registration.id) ?? null },
    })),
  };
}
