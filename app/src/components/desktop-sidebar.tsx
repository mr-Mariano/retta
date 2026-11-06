import { cookies } from "next/headers";
import { canOrganize, MODE_COOKIE, parseMode } from "@/lib/mode";
import { joinHref, loadNotices, type Notice } from "@/lib/notices";
import { createClient } from "@/lib/supabase/server";
import { formatDay, formatTime } from "@/lib/time";
import type { PopoverInvite, PopoverLine } from "./avisos-popover";
import { SidebarNav, type OrganizeNav, type SidebarItem, type UpcomingItem } from "./sidebar-nav";

interface UpcomingRow {
  match: { id: string; title: string | null; status: string; slot: { starts_at: string; field: { name: string } } };
}

function ago(createdAt: string, now: Date) {
  const minutes = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)} min`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / (24 * 60))} d`;
}

/** One line per notice that asks for nothing (same wording as the Avisos page). */
function lineFor(notice: Notice, now: Date): PopoverLine | null {
  const match = notice.match;
  if (!match) return null;
  const base = { id: notice.id, when: ago(notice.createdAt, now), href: `/retas/${match.id}`, unread: notice.unread };
  const when = `${formatDay(new Date(match.startsAt), now)} ${formatTime(new Date(match.startsAt))}`;
  switch (notice.kind) {
    case "match_confirmed":
      return { ...base, icon: "check", text: `Se armó ${match.title}` };
    case "match_cancelled":
      return { ...base, icon: "coin", text: notice.creditCents ? `+$${notice.creditCents / 100} de saldo · ${match.title}` : `Se canceló ${match.title}` };
    case "match_moved":
      return { ...base, icon: "agent", text: `${match.title} pasó a ${when}` };
    case "reactivation":
      return notice.open ? { ...base, icon: "agent", text: `Una reta para volver · ${when}` } : null;
    case "invite":
      return notice.joined ? { ...base, icon: "check", text: `Te uniste a ${match.title}` } : null;
  }
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
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
  const [{ data: profile }, { count: unread }, { data: balanceCents }, { data: upcoming }, notices] = await Promise.all([
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
    loadNotices(supabase, user.id, 12),
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
  // Organizer mode B (2026-11-06): the sidebar for organizing, behind the Jugar / Organizar switch.
  const role = profile.role;
  const organize: OrganizeNav | null = canOrganize(role)
    ? {
        role,
        initial: parseMode((await cookies()).get(MODE_COOKIE)?.value),
        items:
          role === "player"
            ? [
                { href: "/organizar", label: "Inicio", icon: "inicio" },
                { href: "/perfil/organizar", label: "Tus retas", icon: "retas" },
                { href: "/avisos", label: "Avisos", icon: "avisos", badge },
              ]
            : [
                { href: "/perfil/canchas", label: "Tus canchas", icon: "canchas" },
                { href: "/avisos", label: "Avisos", icon: "avisos", badge },
              ],
        action: role === "player" ? { href: "/organizar/nueva", label: "Nueva reta" } : null,
      }
    : null;
  const next: UpcomingItem[] = (upcoming ?? [])
    .map(({ match }) => ({
      href: `/retas/${match.id}`,
      title: match.title ?? `Reta en ${match.slot.field.name}`,
      when: `${formatDay(new Date(match.slot.starts_at), now)} ${formatTime(new Date(match.slot.starts_at))}`,
      at: match.slot.starts_at,
    }))
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 6);

  const openInvite = notices.find((notice) => notice.kind === "invite" && notice.open && notice.match);
  const invite: PopoverInvite | null = openInvite?.match
    ? (() => {
        const match = openInvite.match;
        const missing = match.min - match.active;
        const minutes = Math.floor((new Date(match.deadline).getTime() - now.getTime()) / 60_000);
        return {
          id: openInvite.id,
          href: joinHref(match),
          cover: match.cover,
          title: `${missing > 0 ? `Faltan ${missing}` : `Quedan ${match.max - match.active}`} · ${match.fieldName}`,
          sub: `${formatDay(new Date(match.startsAt), now)} ${formatTime(new Date(match.startsAt))} · ${match.pricePesos > 0 ? `$${match.pricePesos}` : "Gratis"}`,
          closesIn: match.pending && minutes > 0 && minutes < 24 * 60 ? (minutes < 90 ? `${minutes} min` : `${Math.round(minutes / 60)} h`) : null,
        };
      })()
    : null;
  const lines = notices.map((notice) => lineFor(notice, now)).filter((line): line is PopoverLine => line !== null).slice(0, 6);

  return (
    <SidebarNav
      avisos={{ unread: unread ?? 0, invite, lines }}
      items={items}
      organize={organize}
      upcoming={next}
      name={profile.full_name ?? ""}
      roleLabel={ROLE_LABELS[profile.role] ?? ""}
      searchHref={admin ? null : "/explorar?buscar=1"}
    />
  );
}
