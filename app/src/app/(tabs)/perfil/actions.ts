"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parsePhone } from "@/lib/phone-validation";

export interface EditState {
  error?: string;
  values?: Record<string, string>;
}

const SAVED = "/perfil?aviso=guardado";

async function saveProfile(changes: Record<string, string | null>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return supabase.from("profiles").update(changes).eq("id", user.id);
}

export async function updateName(_prev: EditState, formData: FormData): Promise<EditState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "Escribe tu nombre.", values: { full_name: fullName } };
  const { error } = await saveProfile({ full_name: fullName });
  if (error) return { error: "No pudimos guardar tu nombre. Inténtalo de nuevo.", values: { full_name: fullName } };
  // Data changed: drop the browser's cached pages.
  revalidatePath("/", "layout");
  redirect(SAVED);
}

export async function updatePhone(_prev: EditState, formData: FormData): Promise<EditState> {
  const raw = String(formData.get("phone") ?? "");
  const country = String(formData.get("phone_country") ?? "");
  const values = { phone: raw, phone_country: country };
  const phone = parsePhone(raw, country);
  if (!phone.ok) return { error: phone.error, values };
  const { error } = await saveProfile({ phone: phone.e164 });
  if (error) return { error: "No pudimos guardar tu teléfono. Inténtalo de nuevo.", values };
  // Data changed: drop the browser's cached pages.
  revalidatePath("/", "layout");
  redirect(SAVED);
}

/** Accepts "@user", "user" or a pasted profile link, and keeps only the username. */
function username(raw: string, host: string) {
  return raw
    .trim()
    .replace(new RegExp(`^(https?://)?(www\\.|m\\.)?${host}/`, "i"), "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
}

export async function updateSocials(_prev: EditState, formData: FormData): Promise<EditState> {
  const instagram = username(String(formData.get("instagram") ?? ""), "instagram\\.com");
  const facebook = username(String(formData.get("facebook") ?? ""), "facebook\\.com");
  const values = { instagram, facebook };

  if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) {
    return { error: "Ese usuario de Instagram no es válido.", values };
  }
  if (facebook && !/^[A-Za-z0-9.]{5,50}$/.test(facebook)) {
    return { error: "Ese usuario de Facebook no es válido.", values };
  }

  const { error } = await saveProfile({ instagram: instagram || null, facebook: facebook || null });
  if (error) return { error: "No pudimos guardar tus redes. Inténtalo de nuevo.", values };
  // Data changed: drop the browser's cached pages.
  revalidatePath("/", "layout");
  redirect(SAVED);
}
