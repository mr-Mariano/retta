import { BottomNav } from "@/components/bottom-nav";
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
      <BottomNav admin={profile?.role === "admin"} />
    </>
  );
}
