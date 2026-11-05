import { createClient } from "@/lib/supabase/server";
import { formatDay, formatTime } from "@/lib/time";
import { SidebarNav, type SidebarItem, type UpcomingItem } from "./sidebar-nav";

interface UpcomingRow {
  match: { id: string; title: string | null; status: string; slot: { starts_at: string; field: { name: string } } };
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  organizer: "Organizador",
  field_manager: "Responsable de cancha",
  player: "Jugador",
};

/**
 * Desktop sidebar (≥1024 px, option E, 2026-11-04): sections, Avisos with
 * its count, the player's next matches and the profile at the bottom, like a
 * chat app. Nothing renders for signed-out visitors; CSS hides it on phones.
 */
export async function DesktopSidebar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const now = new Date();
  const [{ data: profile }, { count: unread }, { data: balanceCents }, { data: upcoming }] = await Promise.all([
    supabase.from("profiles").select("full_name, role, phone").eq("id", user.id).maybeSingle(),
    supabase
      .from("notices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null)
      .is("dismissed_at", null),
    supabase.rpc("my_balance"),
    supabase
      .from("registrations")
      .select("match:matches!inner(id, title, status, slot:slots!inner(starts_at, field:fields!inner(name)))")
      .eq("player_id", user.id)
      .eq("status", "active")
      .neq("match.status", "cancelled")
      .gt("match.slot.starts_at", now.toISOString())
      .returns<UpcomingRow[]>(),
  ]);
  if (!profile?.phone) return null;

  const admin = profile.role === "admin";
  const balance = Math.max(balanceCents ?? 0, 0) / 100;
  const badge = unread ? String(unread) : undefined;
  const items: SidebarItem[] = admin
    ? [
        { href: "/admin", label: "Inicio", icon: "inicio" },
        { href: "/admin/canchas", label: "Canchas", icon: "canchas" },
        { href: "/admin/usuarios", label: "Usuarios", icon: "usuarios" },
        { href: "/admin/retas", label: "Retas", icon: "retas" },
        { href: "/avisos", label: "Avisos", icon: "avisos", badge },
      ]
    : [
        { href: "/explorar", label: "Explorar", icon: "explorar" },
        { href: "/mis-retas", label: "Mis retas", icon: "misRetas" },
        { href: "/avisos", label: "Avisos", icon: "avisos", badge },
        { href: "/saldo", label: "Saldo", icon: "saldo", note: `$${balance}` },
      ];
  const next: UpcomingItem[] = (upcoming ?? [])
    .map(({ match }) => ({
      href: `/retas/${match.id}`,
      title: match.title ?? `Reta en ${match.slot.field.name}`,
      when: `${formatDay(new Date(match.slot.starts_at), now)} ${formatTime(new Date(match.slot.starts_at))}`,
      at: match.slot.starts_at,
    }))
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 6);

  return (
    <SidebarNav
      items={items}
      upcoming={next}
      name={profile.full_name ?? ""}
      roleLabel={ROLE_LABELS[profile.role] ?? ""}
      searchHref={admin ? null : "/explorar?buscar=1"}
    />
  );
}
