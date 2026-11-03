import Link from "next/link";
import { DropOutButton } from "./drop-out-button";

export interface DropOutInfo {
  matchId: string;
  title: string;
  /** Everything the player paid for this sign-up (charge plus credit used). */
  paidCents: number;
  active: number;
  min: number;
  max: number;
  confirmed: boolean;
}

/** What happens to the match once this player leaves. */
function afterLine({ active, min, max, confirmed }: DropOutInfo) {
  const left = active - 1;
  if (confirmed && left >= min) return `La reta sigue armada con ${left}/${max}.`;
  const need = min - left;
  return `La reta volverá a quedar en ${left}/${max} y necesitará ${need === 1 ? "1 más" : `${need} más`} para confirmarse.`;
}

/** Drop-out confirmation (J07): states the credit before confirming (session 5). */
export function DropOutSheet({ info, closeHref }: { info: DropOutInfo; closeHref: string }) {
  const credit = info.paidCents / 100;
  return (
    <div className="fixed inset-0 z-30 mx-auto max-w-md">
      <Link href={closeHref} scroll={false} aria-label="Cerrar" className="absolute inset-0 animate-fade-in bg-black/60" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="baja-titulo"
        className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] animate-sheet-up flex-col overflow-y-auto gap-4 rounded-t-[28px] border-t border-line bg-surface px-5 pt-3 pb-8"
      >
        <span aria-hidden="true" className="h-[5px] w-10 self-center rounded-full bg-line" />
        <div className="flex flex-col gap-1">
          <h2 id="baja-titulo" className="font-display text-[28px] leading-none font-medium">
            ¿Te das de baja?
          </h2>
          <span className="text-[15px] text-muted">{info.title}</span>
        </div>
        <ul className="flex flex-col gap-2.5 text-[15px] leading-[1.45]">
          <li className="flex gap-2.5">
            <span aria-hidden="true">·</span>
            {credit > 0 ? (
              <span>
                Recibirás <strong className="font-semibold">${credit} de saldo</strong> para tu próxima reta.
              </span>
            ) : (
              <span>Es una reta gratis: no hay saldo que devolver.</span>
            )}
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden="true">·</span>
            <span>Tu lugar quedará libre para otro jugador.</span>
          </li>
          <li className="flex gap-2.5 text-muted">
            <span aria-hidden="true">·</span>
            <span>{afterLine(info)}</span>
          </li>
        </ul>
        <DropOutButton matchId={info.matchId} />
        <Link
          href={closeHref}
          scroll={false}
          className="flex h-[52px] items-center justify-center rounded-full border border-line text-[17px] font-semibold text-ink"
        >
          Mejor me quedo
        </Link>
      </section>
    </div>
  );
}
