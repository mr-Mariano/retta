import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type Role = "player" | "field_manager" | "admin";

/** Signed-in user with one of `roles`; anyone else goes back to their profile. */
export async function requireRole(roles: Role[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !roles.includes(profile.role as Role)) redirect("/perfil");
  return { supabase, user, role: profile.role as Role };
}
