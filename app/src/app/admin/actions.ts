"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/roles";

export interface CreateFieldState {
  error?: string;
}

const COVERS = ["foto-1", "foto-2", "foto-3", "foto-4", "foto-5", "foto-6"];

/** New field from the 3-step flow (admin flow B, 2026-11-04). */
export async function createField(_prev: CreateFieldState, formData: FormData): Promise<CreateFieldState> {
  const { supabase } = await requireRole(["admin"]);

  const name = String(formData.get("name") ?? "").trim();
  const cover = String(formData.get("cover_image") ?? "");
  const address = String(formData.get("address") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  const managerId = String(formData.get("manager_id") ?? "");
  const changingRooms = formData.get("has_changing_rooms") === "on";

  if (name.length < 3) return { error: "Escribe el nombre de la cancha." };
  if (!COVERS.includes(cover)) return { error: "Elige una foto." };
  if (!address || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return { error: "Ubica la cancha en el mapa." };
  if (!managerId) return { error: "Elige quién la administra." };

  const { error } = await supabase.from("fields").insert({
    name,
    cover_image: cover,
    address,
    area: area || null,
    latitude,
    longitude,
    manager_id: managerId,
    has_changing_rooms: changingRooms,
  });
  if (error) return { error: "No se pudo crear la cancha. Intenta de nuevo." };

  revalidatePath("/", "layout");
  redirect("/admin/canchas");
}

const ROLES = ["player", "organizer", "field_manager", "admin"];

/** Role sheet in Usuarios: tapping a role saves it (set_user_role checks admin and self). */
export async function setRole(userId: string, role: string) {
  const { supabase } = await requireRole(["admin"]);
  if (!ROLES.includes(role)) redirect("/admin/usuarios");
  const { error } = await supabase.rpc("set_user_role", { p_user_id: userId, p_role: role });
  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios?aviso=${error ? (error.message.includes("own_role") ? "propio" : "error") : "rol"}`);
}

/** Retas sheet: an admin cancels any match before it starts; the reason is optional. */
export async function cancelMatchAsAdmin(matchId: string, formData: FormData) {
  const { supabase } = await requireRole(["admin"]);
  const note = String(formData.get("note") ?? "").trim();
  const { error } = await supabase.rpc("cancel_match", { p_match_id: matchId, p_note: note || null });
  revalidatePath("/", "layout");
  redirect(`/admin/retas?aviso=${error ? "error" : "cancelada"}`);
}
