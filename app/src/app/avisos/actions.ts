"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Hides a notice (invite "✕", reactivation "Otro día"). RLS limits it to the user's own. */
export async function dismissNotice(id: string) {
  const supabase = await createClient();
  await supabase.from("notices").update({ dismissed_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/", "layout");
}

/** Opening Avisos clears the bell's count. */
export async function markAllRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notices").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  revalidatePath("/explorar");
}
