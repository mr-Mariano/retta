"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parsePhone } from "@/lib/phone-validation";

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

/** Public origin of this request, for OAuth and email redirect URLs. */
async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await requestOrigin()}/auth/callback` },
  });
  if (error || !data.url) redirect("/entrar?error=google");
  redirect(data.url);
}

export async function signUpWithEmail(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
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
      emailRedirectTo: `${await requestOrigin()}/auth/callback`,
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
  redirect("/explorar");
}

export async function signInWithEmail(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error?.code === "email_not_confirmed") {
    return { error: "Confirma tu correo antes de entrar. Revisa tu bandeja.", email };
  }
  if (error) return { error: "Correo o contraseña incorrectos.", email };

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", data.user.id)
    .maybeSingle();
  redirect(profile?.phone ? "/explorar" : "/completa-perfil");
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

  redirect("/explorar");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
