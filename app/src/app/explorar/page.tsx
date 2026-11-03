import type { Metadata } from "next";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Explorar · Retta" };

// Placeholder until the Explore screen is built.
export default async function Explorar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
    : { data: null };
  const firstName = profile?.full_name?.split(/\s+/)[0];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pt-14 pb-8">
      <span className="text-[15px] text-muted">Hola{firstName ? `, ${firstName}` : ""}</span>
      <h1 className="font-display text-4xl leading-none font-extrabold">Retas cerca de ti</h1>
      <p className="text-[15px] leading-normal text-muted">Esta pantalla está en construcción.</p>
      <form action={signOut} className="mt-auto">
        <button type="submit" className="h-12 w-full rounded-full border border-line text-base font-bold text-ink">
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
