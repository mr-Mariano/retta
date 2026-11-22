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
  const { data: role } = user
    ? await supabase.rpc("my_role")
    : { data: null };

  return (
    <>
      {children}
      {user && <BottomNav
        admin={role === "admin"}
        organizer={canOrganize(role) ? (role as "player" | "field_manager") : null}
        initialMode={parseMode((await cookies()).get(MODE_COOKIE)?.value)}
      />}
    </>
  );
}
