import "server-only";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/roles";

/** A field its manager (or an admin) can run. */
export async function loadManagedField(id: string) {
  const { supabase, user, role } = await requireRole(["field_manager", "admin"]);
  const { data: field } = await supabase.from("fields").select("id, name, area, manager_id").eq("id", id).maybeSingle();
  if (!field || (field.manager_id !== user.id && role !== "admin")) notFound();
  return { supabase, field };
}
