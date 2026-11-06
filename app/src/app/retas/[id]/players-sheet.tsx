import Link from "next/link";
import { FacebookIcon, InstagramIcon, facebookUrl, instagramUrl } from "@/components/social-icons";

export interface MatchPlayer {
  id: string;
  full_name: string;
  /** Matches (not cancelled) both players are signed up for, this one included. */
  shared: number;
  instagram: string | null;
  facebook: string | null;
}

// Avatar tints, picked by name so each player keeps the same one.
const TINTS = ["#2B3A66", "#4A2F5E", "#5E4A2F", "#2F5E4A", "#5E2F3A"];
const tint = (name: string) => TINTS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TINTS.length];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

function sharedLabel(shared: number) {
  if (shared === 0) return "Aún no han jugado juntos";
  return shared === 1 ? "Primera reta juntos" : `${shared} retas juntos`;
}

/** Sign-up list with an optional player card on top (session 7: socials only after a shared match). */
export function PlayersSheet({ matchId, players, selectedId }: { matchId: string; players: MatchPlayer[]; selectedId?: string }) {
  const selected = players.find((player) => player.id === selectedId);
  const others = players.filter((player) => player !== selected);
  const base = `/retas/${matchId}`;

  return (
    <div className="fixed inset-0 z-30 mx-auto max-w-md lg:max-w-none!">
      <Link href={base} scroll={false} aria-label="Cerrar" className="absolute inset-0 animate-fade-in bg-black/60" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="jugadores-titulo"
        className="absolute inset-x-0 bottom-0 flex animate-sheet-up max-h-[85dvh] flex-col gap-4 overflow-y-auto rounded-t-[10px] border-t border-line bg-surface px-5 pt-3 pb-8 lg:inset-x-auto lg:bottom-auto lg:top-1/2 lg:left-1/2 lg:w-[480px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:animate-fade-in lg:rounded-[8px] lg:border lg:border-line lg:pb-6 lg:shadow-[0_30px_60px_rgb(0_0_0/0.6)]"
      >
        <span aria-hidden="true" className="h-[5px] w-10 shrink-0 self-center rounded-[6px] bg-line lg:hidden" />

        {selected ? (
          <>
            <div className="flex items-center gap-3.5">
              <Avatar name={selected.full_name} size="lg" />
              <div className="flex flex-col gap-0.5">
                <h2 id="jugadores-titulo" className="font-display text-[26px] leading-none font-extrabold tracking-tight">
                  {selected.full_name}
                </h2>
                <span className="text-sm text-muted">{sharedLabel(selected.shared)}</span>
              </div>
            </div>
            {selected.instagram || selected.facebook ? (
              <div className="flex flex-col gap-2">
                {selected.instagram && (
                  <SocialLink href={instagramUrl(selected.instagram)} icon={<InstagramIcon />} value={`@${selected.instagram}`} network="Instagram" />
                )}
                {selected.facebook && (
                  <SocialLink href={facebookUrl(selected.facebook)} icon={<FacebookIcon />} value={selected.facebook} network="Facebook" />
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">
                {selected.shared === 0 ? "Sus redes aparecen cuando compartan una reta." : "No ha vinculado sus redes."}
              </p>
            )}
            {others.length > 0 && <h3 className="-mb-1.5 text-[13px] font-semibold text-muted">También en esta reta</h3>}
          </>
        ) : (
          <h2 id="jugadores-titulo" className="font-display text-[28px] leading-none font-extrabold tracking-tight">
            Inscritos
          </h2>
        )}

        <ul className="flex flex-col divide-y divide-line">
          {others.map((player) => (
            <li key={player.id}>
              <Link href={`${base}?jugador=${player.id}`} scroll={false} className="flex items-center gap-3 py-2.5 text-ink">
                <Avatar name={player.full_name} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">{player.full_name}</span>
                  <span className="text-xs text-muted">{sharedLabel(player.shared)}</span>
                </span>
                {player.instagram && (
                  <span className="flex size-8 items-center justify-center rounded-full bg-elevated" aria-label="Tiene Instagram">
                    <InstagramIcon size={18} />
                  </span>
                )}
                {player.facebook && (
                  <span className="flex size-8 items-center justify-center rounded-full bg-elevated" aria-label="Tiene Facebook">
                    <FacebookIcon size={18} />
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Avatar({ name, size }: { name: string; size?: "lg" }) {
  return (
    <span
      aria-hidden="true"
      style={{ background: tint(name) }}
      className={`flex shrink-0 items-center justify-center rounded-[6px] font-semibold text-white ${
        size === "lg" ? "size-[60px] text-[22px]" : "size-9 text-[13px]"
      }`}
    >
      {initials(name)}
    </span>
  );
}

function SocialLink({ href, icon, value, network }: { href: string; icon: React.ReactNode; value: string; network: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex h-[50px] items-center gap-3 rounded-[6px] bg-elevated px-4 text-ink">
      {icon}
      <span className="flex-1 truncate text-[16px] font-semibold">{value}</span>
      <span className="text-[13px] text-muted">{network}</span>
    </a>
  );
}
