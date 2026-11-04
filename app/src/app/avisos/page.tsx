import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { joinHref, loadNotices, type Notice } from "@/lib/notices";
import { createClient } from "@/lib/supabase/server";
import { formatDay, formatTime } from "@/lib/time";
import { InviteDeck, type InviteCard } from "./invite-deck";
import { MarkRead } from "./mark-read";

export const metadata: Metadata = { title: "Avisos · Retta" };

function when(startsAt: string, now: Date) {
  const date = new Date(startsAt);
  return `${formatDay(date, now)} ${formatTime(date)}`;
}

function ago(createdAt: string, now: Date) {
  const minutes = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)} min`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / (24 * 60))} d`;
}

/** One line per notice that asks for nothing; null for notices that are not shown here. */
function line(notice: Notice, now: Date) {
  const match = notice.match;
  if (!match) return null;
  switch (notice.kind) {
    case "match_confirmed":
      return { icon: "check" as const, text: <>Se armó <strong className="font-semibold">{match.title}</strong></> };
    case "match_cancelled":
      return notice.creditCents
        ? { icon: "coin" as const, text: <><strong className="font-semibold">+${notice.creditCents / 100}</strong> de saldo · {match.title}</> }
        : { icon: "coin" as const, text: <>Se canceló <strong className="font-semibold">{match.title}</strong></> };
    case "match_moved":
      return { icon: "agent" as const, text: <><strong className="font-semibold">{match.title}</strong> pasó a {when(match.startsAt, now)}</> };
    case "reactivation":
      return notice.open ? { icon: "agent" as const, text: <>Una reta para volver · {when(match.startsAt, now)}</> } : null;
    case "invite":
      return notice.joined ? { icon: "check" as const, text: <>Te uniste a <strong className="font-semibold">{match.title}</strong></> } : null;
  }
}

export default async function Avisos() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const now = new Date();
  const notices = await loadNotices(supabase, user.id);
  const invites: InviteCard[] = notices
    .filter((notice) => notice.kind === "invite" && notice.open && notice.match)
    .map((notice) => ({ id: notice.id, href: joinHref(notice.match!), match: notice.match!, when: when(notice.match!.startsAt, now) }));
  const lines = notices
    .map((notice) => ({ notice, line: line(notice, now) }))
    .filter((item) => item.line !== null);

  return (
    <main className="avisos-reveal mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] bg-base px-4 pt-14 pb-10">
      <MarkRead unread={notices.some((notice) => notice.unread)} />
      <Link href="/explorar" className="flex items-center gap-3 self-start text-[15px] font-semibold text-muted">
        <span className="flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </span>
        Explorar
      </Link>

      <div className="cascade flex flex-col gap-[18px]">
        <h1 className="font-display text-[34px] leading-none font-medium">Avisos</h1>

        {invites.length > 0 && <InviteDeck cards={invites} />}

        {lines.length > 0 && (
          <section className="flex flex-col">
            <h2 className="text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">Listo</h2>
            <ul className="flex flex-col">
              {lines.map(({ notice, line: item }) => (
                <li key={notice.id}>
                  <Link href={`/retas/${notice.match!.id}`} className="flex items-center gap-2.5 border-b border-line py-2.5">
                    <LineIcon kind={item!.icon} />
                    <span className="flex-1 text-[15px]">{item!.text}</span>
                    <span className="text-xs text-muted">{ago(notice.createdAt, now)}</span>
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {invites.length === 0 && lines.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Image src="/mascota/espera.png" alt="" width={120} height={120} />
            <p className="text-[15px] text-muted">No tienes avisos por ahora.</p>
          </div>
        )}
      </div>
    </main>
  );
}

function LineIcon({ kind }: { kind: "check" | "coin" | "agent" }) {
  if (kind === "agent") {
    return (
      <span aria-hidden="true" className="agent-mark flex size-7 shrink-0 items-center justify-center rounded-full">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex size-7 shrink-0 items-center justify-center rounded-full ${kind === "check" ? "bg-action text-on-action" : "bg-elevated text-ink"}`}
    >
      {kind === "check" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
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
