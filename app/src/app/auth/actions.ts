"use server";

import { authReturn } from "@/lib/auth-return";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parsePhone } from "@/lib/phone-validation";
import { RECOVERY_COOKIE, RECOVERY_REQUEST_PATH } from "@/lib/password-recovery";

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignUpState {
  errors?: { fullName?: string; email?: string; phone?: string; password?: string };
  values?: { fullName: string; email: string; phone: string; country: string };
  message?: string;
  checkEmail?: boolean;
}

export interface SignInState {
  error?: string;
  email?: string;
}

export interface ProfileState {
  error?: string;
  values?: { phone: string; country: string };
}

/** Public origin of this request, for email redirect URLs. */
async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function signUpWithEmail(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const destination = authReturn(formData.get("next"));
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const rawPhone = String(formData.get("phone") ?? "");
  const country = String(formData.get("phone_country") ?? "");
  const password = String(formData.get("password") ?? "");
  const values = { fullName, email, phone: rawPhone, country };

  const errors: NonNullable<SignUpState["errors"]> = {};
  if (!fullName) errors.fullName = "Escribe tu nombre.";
  if (!EMAIL_PATTERN.test(email)) errors.email = "Escribe un correo válido.";
  const phone = parsePhone(rawPhone, country);
  if (!phone.ok) errors.phone = phone.error;
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = "Usa al menos 8 caracteres.";
  if (Object.keys(errors).length > 0 || !phone.ok) return { errors, values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone: phone.e164 },
      emailRedirectTo: `${await requestOrigin()}/auth/callback${destination ? `?${new URLSearchParams({ next: destination })}` : ""}`,
    },
  });

  // With email confirmation on, an existing address returns a user with no identities.
  const emailTaken =
    error?.code === "user_already_exists" ||
    error?.code === "email_exists" ||
    (data.user && data.user.identities?.length === 0);
  if (emailTaken) {
    return { errors: { email: "Ya hay una cuenta con este correo." }, values };
  }
  if (error?.code === "weak_password") {
    return { errors: { password: "Usa al menos 8 caracteres." }, values };
  }
  if (error) {
    return { message: "No pudimos crear tu cuenta. Inténtalo de nuevo en un momento.", values };
  }

  if (!data.session) return { checkEmail: true, values };
  // Data changed: drop the browser's cached pages.
  revalidatePath("/", "layout");
  redirect(destination || "/explorar");
}

export async function signInWithEmail(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error?.code === "email_not_confirmed") {
    return { error: "Confirma tu correo antes de entrar. Revisa tu bandeja.", email };
  }
  if (error) return { error: "Correo o contraseña incorrectos.", email };

  const [{ data: role }, { data: phone }] = await Promise.all([
    supabase.rpc("my_role"),
    supabase.rpc("my_profile_phone"),
  ]);
  // Data changed: drop the browser's cached pages.
  revalidatePath("/", "layout");
  redirect(!phone ? "/completa-perfil" : authReturn(formData.get("next")) || (role === "admin" ? "/admin" : "/explorar"));
}

export interface RecoveryState {
  error?: string;
  sent?: boolean;
}

export async function requestPasswordRecovery(_prev: RecoveryState, formData: FormData): Promise<RecoveryState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { error: "Escribe un correo válido." };

  const supabase = await createClient();
  // Reuse the existing allow-listed callback. The PKCE exchange identifies a recovery.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await requestOrigin()}/auth/callback`,
  });
  if (error) console.warn("[auth] recovery request failed", error.code ?? error.status);
  // Give the same response for known and unknown accounts.
  return { sent: true };
}

export async function resetRecoveredPassword(_prev: RecoveryState, formData: FormData): Promise<RecoveryState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) return { error: "Usa al menos 8 caracteres." };
  if (password !== formData.get("confirm_password")) return { error: "Las contraseñas no coinciden." };

  const cookieStore = await cookies();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || cookieStore.get(RECOVERY_COOKIE)?.value !== user.id) {
    redirect(`${RECOVERY_REQUEST_PATH}?error=link`);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error?.code === "same_password") return { error: "Elige una contraseña distinta a la anterior." };
  if (error?.code === "weak_password") return { error: "La contraseña no cumple los requisitos de seguridad. Prueba con una más larga." };
  if (error) return { error: "No pudimos guardar tu contraseña. Inténtalo de nuevo o solicita otro enlace." };

  cookieStore.delete(RECOVERY_COOKIE);
  await supabase.auth.signOut({ scope: "global" });
  revalidatePath("/", "layout");
  redirect("/entrar?restablecida=1");
}

export async function completeProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const rawPhone = String(formData.get("phone") ?? "");
  const country = String(formData.get("phone_country") ?? "");
  const values = { phone: rawPhone, country };

  const phone = parsePhone(rawPhone, country);
  if (!phone.ok) return { error: phone.error, values };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { error } = await supabase.from("profiles").update({ phone: phone.e164 }).eq("id", user.id);
  if (error) return { error: "No pudimos guardar tu teléfono. Inténtalo de nuevo.", values };

  // Data changed: drop the browser's cached pages.
  revalidatePath("/", "layout");
  redirect("/explorar");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Data changed: drop the browser's cached pages.
  revalidatePath("/", "layout");
  redirect("/");
}
