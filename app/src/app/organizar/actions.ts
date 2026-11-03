"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface CreateMatchState {
  error?: string;
}

const FORMATS = ["fut5", "fut7", "fut11"];
const LEVELS = ["beginner", "intermediate", "advanced"];
const TYPES = ["men", "women", "mixed"];

/** Publishes a match on a free slot (session 2 rules are enforced again by the database). */
export async function createMatch(_prev: CreateMatchState, formData: FormData): Promise<CreateMatchState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const slotId = String(formData.get("slot_id") ?? "");
  const min = Number(formData.get("min_players"));
  const max = Number(formData.get("max_players"));
  const pesos = Number(formData.get("price"));
  const hoursBefore = Number(formData.get("deadline_hours"));
  const format = String(formData.get("format"));
  const level = String(formData.get("level"));
  const type = String(formData.get("type"));
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!slotId) return { error: "Elige un horario." };
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 2 || min > max || max > 30) {
    return { error: "Revisa el mínimo y el máximo de jugadores." };
  }
  if (!Number.isInteger(pesos) || pesos < 0 || pesos > 10000) return { error: "Revisa el precio." };
  if (!FORMATS.includes(format) || !LEVELS.includes(level) || !TYPES.includes(type)) return { error: "Elige cómo se juega." };

  const { data: slot } = await supabase.from("slots").select("starts_at").eq("id", slotId).single();
  if (!slot) return { error: "Ese horario ya no existe." };
  const deadline = new Date(new Date(slot.starts_at).getTime() - hoursBefore * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("matches")
    .insert({
      slot_id: slotId,
      organizer_id: user.id,
      title: title || null,
      description: description || null,
      min_players: min,
      max_players: max,
      price_cents: pesos * 100,
      confirmation_deadline: deadline.toISOString(),
      format,
      level,
      type,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Alguien acaba de tomar ese horario. Elige otro." };
    if (error.message.includes("deadline")) return { error: "Ese cierre ya no es posible. Elige uno más tarde o cambia el horario." };
    return { error: "No pudimos publicar la reta. Inténtalo de nuevo." };
  }

  // Data changed: drop the browser's cached pages.
  revalidatePath("/", "layout");
  redirect(`/organizar/${data.id}?aviso=publicada`);
}

export interface CancelState {
  error?: string;
}

/** Organizer cancellation with a required reason; everyone gets their money back as credit. */
export async function cancelOwnMatch(matchId: string, _prev: CancelState, formData: FormData): Promise<CancelState> {
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { error: "Escribe el motivo." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_match", { p_match_id: matchId, p_note: note });
  if (error) return { error: "No pudimos cancelar la reta. Inténtalo de nuevo." };
  // Data changed: drop the browser's cached pages.
  revalidatePath("/", "layout");
  redirect("/perfil/organizar?aviso=cancelada");
}

/** Marks one player as present or absent; the database checks the 24 h window. */
export async function markAttendance(registrationId: string, attendance: "present" | "absent") {
  const supabase = await createClient();
  const { error } = await supabase.from("registrations").update({ attendance }).eq("id", registrationId);
  if (error) return { error: "No pudimos guardar. Inténtalo de nuevo." };
  revalidatePath("/", "layout");
  return {};
}
