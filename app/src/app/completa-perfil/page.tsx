import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { PerfilForm } from "./perfil-form";

export const metadata: Metadata = { title: "Completa tu perfil · Retta" };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export default async function CompletaPerfil() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const name = profile?.full_name ?? user.email ?? "";
  const provider = user.app_metadata.provider === "google" ? "Conectado con Google" : "Tu cuenta";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-7 px-5 pt-13 pb-8">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-muted">Último paso</span>
        <form action={signOut}>
          <button type="submit" className="h-11 text-sm font-semibold text-muted">
            Cerrar sesión
          </button>
        </form>
      </div>
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-[44px] leading-[0.95] font-extrabold">¿A qué número te avisamos?</h1>
        <p className="text-[15px] leading-normal text-muted">El organizador lo usa para recordarte la reta por WhatsApp.</p>
      </div>
      <PerfilForm account={{ initials: initials(name), label: `${provider} · ${user.email ?? ""}` }} />
    </main>
  );
}
