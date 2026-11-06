import { BottomNav } from "@/components/bottom-nav";
import { cookies } from "next/headers";
import { canOrganize, MODE_COOKIE, parseMode } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";

/** Sections reached from the bottom nav; the nav stays put while pages change. Admins get their own nav. */
export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <>
      {children}
      <BottomNav
        admin={profile?.role === "admin"}
        organizer={canOrganize(profile?.role) ? (profile?.role as "player" | "field_manager") : null}
        initialMode={parseMode((await cookies()).get(MODE_COOKIE)?.value)}
      />
    </>
  );
}
