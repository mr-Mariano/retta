import Image from "next/image";
import Link from "next/link";
import { AgentMark } from "@/components/agent-mark";
import { joinHref, type Notice } from "@/lib/notices";
import { formatDay, formatTime } from "@/lib/time";
import { dismissNotice } from "./actions";

const FILTERS = [
  { key: undefined, label: "Todos" },
  { key: "invitaciones", label: "Invitaciones" },
  { key: "retas", label: "Mis retas" },
  { key: "saldo", label: "Saldo" },
] as const;

function ago(createdAt: string, now: Date) {
  const minutes = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)} min`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / (24 * 60))} d`;
}

function inFilter(notice: Notice, filter: string | undefined) {
  if (filter === "invitaciones") return notice.kind === "invite" || notice.kind === "reactivation";
  if (filter === "saldo") return notice.kind === "match_cancelled";
  if (filter === "retas") return notice.kind === "match_confirmed" || notice.kind === "match_moved" || (notice.kind === "invite" && notice.joined);
  return true;
}

/** Title and one-line summary for a notice. */
function describe(notice: Notice, now: Date) {
  const match = notice.match!;
  const when = `${formatDay(new Date(match.startsAt), now)} ${formatTime(new Date(match.startsAt))}`;
  const missing = match.min - match.active;
  switch (notice.kind) {
    case "invite":
      return notice.joined
        ? { title: `Te uniste a ${match.title}`, sub: `${when} · ${match.fieldName}` }
        : notice.open
          ? { title: `Te invitan: ${match.fieldName}`, sub: `${missing > 0 ? `Faltan ${missing}` : `Quedan ${match.max - match.active}`} · ${when}` }
          : { title: `Te invitaron: ${match.title}`, sub: "Ya no está disponible" };
    case "reactivation":
      return { title: "Una reta para volver", sub: `${match.title} · ${when}` };
    case "match_confirmed":
      return { title: `Se armó ${match.title}`, sub: `${when} · tu lugar está fijo` };
    case "match_cancelled":
      return notice.creditCents
        ? { title: `+$${notice.creditCents / 100} de saldo`, sub: `Se canceló ${match.title}: no se juntó el mínimo` }
        : { title: `Se canceló ${match.title}`, sub: when };
    case "match_moved":
      return { title: `${match.title} cambió de hora`, sub: `Ahora es ${when} en ${match.fieldName}` };
  }
}

function Icon({ notice }: { notice: Notice }) {
  if (notice.kind === "invite" || notice.kind === "reactivation" || notice.kind === "match_moved") return <AgentMark size={30} />;
  const check = notice.kind === "match_confirmed";
  return (
    <span aria-hidden="true" className={`flex size-[30px] shrink-0 items-center justify-center rounded-full ${check ? "bg-action text-on-action" : "bg-elevated text-ink"}`}>
      {check ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M9 9.5h4.5a2 2 0 0 1 0 4H10a2 2 0 0 0 0 4h5" />
        </svg>
      )}
    </span>
  );
}

/**
 * Desktop Avisos (D, 2026-11-06): compact list on the left grouped by day,
 * the selected notice open on the right with its actions.
 */
export function Inbox({ notices, selectedId, filter }: { notices: Notice[]; selectedId?: string; filter?: string }) {
  const now = new Date();
  const list = notices.filter((notice) => notice.match && inFilter(notice, filter));
  const selected = list.find((notice) => notice.id === selectedId) ?? list[0];
  const today = list.filter((notice) => now.getTime() - new Date(notice.createdAt).getTime() < 24 * 60 * 60 * 1000);
  const older = list.filter((notice) => !today.includes(notice));
  const href = (params: { aviso?: string; filtro?: string }) => {
    const search = new URLSearchParams();
    const f = "filtro" in params ? params.filtro : filter;
    if (f) search.set("filtro", f);
    if (params.aviso) search.set("aviso", params.aviso);
    return search.size ? `/avisos?${search}` : "/avisos";
  };

  const group = (label: string, items: Notice[]) =>
    items.length > 0 && (
      <>
        <li className="px-4 pt-4 pb-1.5 text-xs font-bold tracking-[0.04em] text-muted uppercase">{label}</li>
        {items.map((notice) => {
          const text = describe(notice, now);
          const active = notice.id === selected?.id;
          return (
            <li key={notice.id}>
              <Link
                href={href({ aviso: notice.id })}
                scroll={false}
                className={`flex items-start gap-3 px-4 py-3.5 ${active ? "bg-surface shadow-[inset_2px_0_0_var(--color-text-primary)]" : "hover:bg-surface/60"}`}
              >
                <span aria-hidden="true" className={`mt-3 size-2 shrink-0 rounded-full ${notice.unread ? "bg-action" : ""}`} />
                <Icon notice={notice} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={`truncate text-sm ${notice.unread ? "font-bold" : "font-medium"}`}>{text.title}</span>
                  <span className="truncate text-[13px] text-muted">{text.sub}</span>
                </span>
                <span className="text-xs text-muted">{ago(notice.createdAt, now)}</span>
              </Link>
            </li>
          );
        })}
      </>
    );

  return (
    <div className="hidden min-h-dvh lg:flex">
      <section className="flex w-[400px] shrink-0 flex-col border-r border-line">
        <div className="flex items-baseline justify-between px-4 pt-8 pb-2">
          <h1 className="text-[32px] leading-none font-extrabold tracking-tight">Avisos</h1>
        </div>
        <nav aria-label="Filtrar avisos" className="flex gap-1.5 px-4 py-2">
          {FILTERS.map((item) => (
            <Link
              key={item.label}
              href={href({ filtro: item.key })}
              scroll={false}
              aria-current={item.key === filter ? "page" : undefined}
              className={`rounded-[4px] px-3 py-1.5 text-[13px] font-semibold ${item.key === filter ? "bg-ink text-(--color-bg-base)" : "bg-surface text-ink/85"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {list.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">Nada por aquí. Te avisamos cuando el agente te invite o se arme tu reta.</p>
        ) : (
          <ul className="flex flex-col overflow-y-auto">
            {group("Hoy", today)}
            {group("Antes", older)}
          </ul>
        )}
      </section>
      {selected ? <Reading notice={selected} now={now} /> : <div className="flex-1" />}
    </div>
  );
}

function Reading({ notice, now }: { notice: Notice; now: Date }) {
  const match = notice.match!;
  const text = describe(notice, now);
  const start = new Date(match.startsAt);
  const invite = (notice.kind === "invite" || notice.kind === "reactivation") && notice.open;
  const minutes = Math.floor((new Date(match.deadline).getTime() - now.getTime()) / 60_000);
  return (
    <section className="flex max-w-[720px] flex-1 flex-col gap-[18px] px-10 py-8">
      <span className="flex items-center gap-2.5 text-sm text-muted">
        <Icon notice={notice} />
        <span>
          <strong className="text-ink">{notice.kind === "invite" || notice.kind === "reactivation" || notice.kind === "match_moved" ? "Agente Retta" : "Retta"}</strong> · hace{" "}
          {ago(notice.createdAt, now)}
        </span>
      </span>
      <h2 className="text-[32px] leading-[1.05] font-extrabold tracking-tight">{invite && notice.kind === "invite" ? `Faltan ${Math.max(match.min - match.active, 0)} en ${match.fieldName}` : text.title}</h2>
      {notice.reason && <p className="text-[16px] leading-relaxed text-ink/85">{notice.reason}</p>}
      <div className="relative h-[200px] overflow-hidden rounded-[4px] bg-elevated">
        <Image src={match.cover} alt="" fill sizes="640px" className="object-cover" />
      </div>
      <div className="flex flex-col">
        <div className="flex gap-4 border-t border-line py-4">
          <span className="flex flex-col gap-0.5">
            <span className="text-[17px] font-semibold">
              {formatDay(start, now)}, {formatTime(start)}
            </span>
            <span className="text-[15px] text-muted">{match.pending && minutes > 0 ? `Cierra a las ${formatTime(new Date(match.deadline))}` : match.pending ? "Por confirmar" : "Ya se armó"}</span>
          </span>
        </div>
        <div className="flex gap-4 border-t border-line py-4">
          <span className="flex flex-col gap-0.5">
            <span className="text-[17px] font-semibold">{match.title}</span>
            <span className="text-[15px] text-muted">
              {match.fieldName} · {match.active}/{match.max} · {match.pricePesos > 0 ? `$${match.pricePesos}` : "Gratis"}
            </span>
          </span>
        </div>
      </div>
      <div className="flex gap-2.5">
        {invite && (
          <Link href={joinHref(match)} className="flex h-11 items-center rounded-[4px] bg-ink px-5 text-[15px] font-bold text-(--color-bg-base)">
            Unirme{match.pricePesos > 0 ? ` · $${match.pricePesos}` : ""}
          </Link>
        )}
        {invite && (
          <form action={dismissNotice.bind(null, notice.id)}>
            <button type="submit" className="pending-button h-11 rounded-[4px] border border-line px-5 text-[15px] font-semibold">
              Ahora no
            </button>
          </form>
        )}
        <Link href={`/retas/${match.id}`} className="flex h-11 items-center rounded-[4px] border border-line px-5 text-[15px] font-semibold">
          Ver la reta
        </Link>
      </div>
    </section>
  );
}
