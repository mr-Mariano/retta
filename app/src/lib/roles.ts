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
  const { data: role } = await supabase.rpc("my_role");
  if (!roles.includes(role as Role)) redirect("/perfil");
  return { supabase, user, role: role as Role };
}
