import type { Metadata } from "next";
import { requireRole } from "@/lib/roles";
import { NewFieldFlow } from "./new-field-flow";

export const metadata: Metadata = { title: "Nueva cancha · Retta" };

export default async function NuevaCancha() {
  const { supabase } = await requireRole(["admin"]);
  const { data: managers } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "field_manager")
    .order("full_name");
  return <NewFieldFlow managers={(managers ?? []) as { id: string; full_name: string }[]} />;
}
