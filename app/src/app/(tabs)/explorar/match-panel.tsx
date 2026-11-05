import Image from "next/image";
import Link from "next/link";
import { CapacityDots } from "@/components/capacity-dots";
import { coverSrc } from "@/lib/covers";
import type { createClient } from "@/lib/supabase/server";
import { formatDay, formatTime } from "@/lib/time";
import { SignUpForm } from "../../retas/[id]/sign-up-form";
import { ClosePanel } from "./close-panel";

interface PanelMatch {
  id: string;
  title: string | null;
  description: string | null;
  min_players: number;
  max_players: number;
  price_cents: number;
  status: "pending" | "confirmed" | "cancelled";
  confirmation_deadline: string;
  format: "fut5" | "fut7" | "fut11";
  level: "beginner" | "intermediate" | "advanced";
  type: "men" | "women" | "mixed";
  slot: { starts_at: string; ends_at: string; field: { name: string; area: string | null; address: string; has_changing_rooms: boolean; cover_image: string } };
  registrations: { player_id: string }[];
}

const FORMAT = { fut5: "Fut 5", fut7: "Fut 7", fut11: "Fut 11" };
const LEVEL = { beginner: "Principiante", intermediate: "Intermedio", advanced: "Avanzado" };
const TYPE = { men: "Varonil", women: "Femenil", mixed: "Mixto" };
const PRIMARY = "flex h-12 items-center justify-center rounded-full bg-action px-6 text-[17px] font-semibold text-on-action";

/**
 * A match in the desktop side panel (option E, detail 1): the results stay
 * visible behind; ✕ or Esc closes it. Paying opens the full match page with
 * its payment sheet, so money always goes through the same flow.
 */
export async function MatchPanel({
  supabase,
  userId,
  matchId,
  closeHref,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  matchId: string;
  closeHref: string;
}) {
  const { data: match } = await supabase
    .from("matches")
    .select(
      "id, title, description, min_players, max_players, price_cents, status, confirmation_deadline, format, level, type, slot:slots!inner(starts_at, ends_at, field:fields!inner(name, area, address, has_changing_rooms, cover_image)), registrations(player_id)",
    )
    .eq("id", matchId)
    .eq("registrations.status", "active")
    .returns<PanelMatch[]>()
    .maybeSingle();
  if (!match) return null;

  const now = new Date();
  const field = match.slot.field;
  const startsAt = new Date(match.slot.starts_at);
  const title = match.title ?? `Reta en ${field.name}`;
  const active = match.registrations.length;
  const signedUp = match.registrations.some((r) => r.player_id === userId);
  const full = active >= match.max_players;
  const closed = match.status === "cancelled" || startsAt <= now || (match.status === "pending" && new Date(match.confirmation_deadline) <= now);
  const pesos = match.price_cents / 100;
  const missing = match.min_players - active;

  return (
    <aside
      aria-label={title}
      className="fixed inset-y-0 right-0 z-30 hidden w-[460px] animate-slide-from-right flex-col gap-3.5 overflow-y-auto border-l border-line bg-surface px-[22px] pt-[18px] pb-[22px] shadow-[-20px_0_40px_rgb(0_0_0/0.45)] lg:flex"
    >
      <ClosePanel href={closeHref} />
      <div className="relative h-[210px] shrink-0 overflow-hidden rounded-[18px] text-white">
        <Image src={coverSrc(field.cover_image)} alt="" fill sizes="416px" className="object-cover" />
        <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgb(10_10_10/0.05),rgb(10_10_10/0.8))]" />
        <span className="absolute inset-x-[18px] bottom-3.5 flex flex-col gap-1">
          <span className="font-display text-[30px] leading-none font-medium">{title}</span>
          <span className="text-[15px] opacity-85">
            {formatDay(startsAt, now)} · {formatTime(startsAt)}–{formatTime(new Date(match.slot.ends_at))} · {field.name}
          </span>
        </span>
      </div>
      <div className="flex flex-col gap-2.5 rounded-2xl bg-elevated p-4">
        <span className="text-[16px]">
          {match.status === "confirmed" ? (
            <strong className="font-semibold">Ya se armó</strong>
          ) : (
            <>
              <strong className="font-semibold">{missing === 1 ? "Falta 1" : `Faltan ${missing}`}</strong>
              <span className="text-muted"> para que se arme · cierra {formatTime(new Date(match.confirmation_deadline))}</span>
            </>
          )}
        </span>
        <CapacityDots active={active} min={match.min_players} max={match.max_players} size="sm" />
      </div>
      <span className="text-[15px] text-muted">
        {FORMAT[match.format]} · {LEVEL[match.level]} · {TYPE[match.type]}
        {field.has_changing_rooms ? " · Vestidores" : ""}
      </span>
      <span className="text-[15px] text-muted">{field.address}</span>
      {match.description && <p className="text-[15px] leading-snug">{match.description}</p>}
      <Link href={`/retas/${match.id}`} className="text-[15px] font-semibold text-action">
        Ver la reta completa
      </Link>

      <div className="mt-auto flex items-center gap-3 pt-2">
        {signedUp ? (
          <>
            <span className="flex flex-1 flex-col">
              <span className="text-[16px] font-semibold">Estás inscrito</span>
              <span className="text-[13px] text-muted">Tu lugar está apartado</span>
            </span>
            <Link href={`/retas/${match.id}`} className="flex h-12 items-center rounded-full border border-line px-5 text-[16px] font-semibold">
              Ver reta
            </Link>
          </>
        ) : closed ? (
          <span className="flex-1 text-[15px] text-muted">Esta reta ya no acepta inscripciones</span>
        ) : full ? (
          <span className="flex-1 text-[15px] text-muted">La reta está llena</span>
        ) : (
          <>
            <span className="flex flex-1 flex-col">
              <span className="text-[16px] font-semibold">{pesos === 0 ? "Gratis" : `$${pesos} · de tu saldo`}</span>
              <span className="text-[13px] text-muted">Si no se arma, te regresamos todo</span>
            </span>
            {pesos === 0 ? (
              <SignUpForm matchId={match.id} label="Inscribirme" className={PRIMARY} />
            ) : (
              <Link href={`/retas/${match.id}?pago=1`} className={PRIMARY}>
                Inscribirme
              </Link>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
