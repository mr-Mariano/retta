import type { Metadata } from "next";
import { requireRole } from "@/lib/roles";
import { CreateFlow, type FieldOption, type SlotOption } from "./create-flow";

export const metadata: Metadata = { title: "Crear reta · Retta" };

const DAYS = 7;
// The deadline must be at least 1 h before start and still ahead, so leave some margin.
const MIN_LEAD_MS = 75 * 60 * 1000;

interface SlotRow {
  id: string;
  field_id: string;
  starts_at: string;
  ends_at: string;
  matches: { status: string }[];
}

export default async function NuevaReta() {
  const { supabase } = await requireRole(["organizer", "admin"]);
  const now = Date.now();

  const [{ data: fields }, { data: slots }] = await Promise.all([
    supabase.from("fields").select("id, name, area, cover_image").order("name"),
    supabase
      .from("slots")
      .select("id, field_id, starts_at, ends_at, matches(status)")
      .gt("starts_at", new Date(now + MIN_LEAD_MS).toISOString())
      .lt("starts_at", new Date(now + DAYS * 24 * 60 * 60 * 1000).toISOString())
      .order("starts_at")
      .returns<SlotRow[]>(),
  ]);

  const slotOptions: SlotOption[] = (slots ?? []).map((slot) => ({
    id: slot.id,
    fieldId: slot.field_id,
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
    // A slot holds one non-cancelled match (session 2).
    taken: slot.matches.some((match) => match.status !== "cancelled"),
  }));

  return <CreateFlow fields={(fields ?? []) as FieldOption[]} slots={slotOptions} />;
}
