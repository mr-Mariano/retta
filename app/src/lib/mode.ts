/**
 * Organizer mode B (2026-11-06): players and field managers switch
 * between playing and organizing. The choice lives in a cookie; pages that
 * belong to one mode (Explorar, Tus retas, Tus canchas…) set it on their own.
 */
export type Mode = "jugar" | "organizar";

export const MODE_COOKIE = "retta-modo";

const ORGANIZE_PATHS = ["/organizar", "/perfil/organizar", "/perfil/canchas", "/canchas"];
const PLAY_PATHS = ["/explorar", "/mis-retas", "/saldo"];

const under = (pathname: string, paths: string[]) => paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

/** The mode a page belongs to, or the chosen one on shared pages (Avisos, Perfil, a match). */
export function modeFor(pathname: string, chosen: Mode): Mode {
  if (under(pathname, ORGANIZE_PATHS)) return "organizar";
  if (under(pathname, PLAY_PATHS)) return "jugar";
  return chosen;
}

export function canOrganize(role: string | null | undefined): role is "player" | "field_manager" {
  return role === "player" || role === "field_manager";
}

/** Where "Organizar" opens: the organizer home, or the field manager's fields. */
export function organizeHome(role: "player" | "field_manager") {
  return role === "field_manager" ? "/perfil/canchas" : "/organizar";
}

export function parseMode(value: string | undefined): Mode {
  return value === "organizar" ? "organizar" : "jugar";
}
