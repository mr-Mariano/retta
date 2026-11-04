"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { NoticeMatch } from "@/lib/notices";
import { dismissNotice } from "./actions";

export interface InviteCard {
  id: string;
  href: string;
  match: NoticeMatch;
  when: string;
}

const SWIPE_PX = 80;

/** "Cierra en 48 min" / "Cierra en 2 h"; null once closed. */
function closesIn(deadline: string, now: number) {
  const minutes = Math.floor((new Date(deadline).getTime() - now) / 60_000);
  if (minutes <= 0 || minutes >= 24 * 60) return null;
  if (minutes < 90) return `Cierra en ${minutes} min`;
  return `Cierra en ${Math.round(minutes / 60)} h`;
}

/**
 * The agent's invitations as a stack of photo cards (variant D). Swipe or
 * use the counter to see the next one; "✕" dismisses, "Unirme" signs up.
 */
export function InviteDeck({ cards: initial }: { cards: InviteCard[] }) {
  const [cards, setCards] = useState(initial);
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const start = useRef<number | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (cards.length === 0) return null;
  const current = cards[index % cards.length]!;
  const { match } = current;
  const missing = match.min - match.active;
  const left = match.max - match.active;
  const countdown = match.pending ? closesIn(match.deadline, now) : null;
  const more = cards.length - 1;

  function next() {
    setIndex((value) => (value + 1) % cards.length);
  }

  function dismiss() {
    const id = current.id;
    setCards((list) => list.filter((card) => card.id !== id));
    setIndex((value) => (cards.length <= 1 ? 0 : value % (cards.length - 1)));
    startTransition(() => dismissNotice(id));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-[268px]">
        {more >= 2 && <span aria-hidden="true" className="absolute inset-x-6 top-0 h-[250px] rounded-[22px] border border-line bg-elevated opacity-60" />}
        {more >= 1 && <span aria-hidden="true" className="absolute inset-x-3 top-2 h-[250px] rounded-[22px] border border-line bg-elevated" />}
        <article
          key={current.id}
          style={{ transform: `translateX(${dragX}px) rotate(${dragX / 40}deg)`, transition: start.current === null ? "transform 200ms ease-out" : "none" }}
          onPointerDown={(event) => {
            if (cards.length < 2) return;
            start.current = event.clientX;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (start.current !== null) setDragX(event.clientX - start.current);
          }}
          onPointerUp={() => {
            const moved = Math.abs(dragX) > SWIPE_PX;
            start.current = null;
            setDragX(0);
            if (moved) next();
          }}
          onPointerCancel={() => {
            start.current = null;
            setDragX(0);
          }}
          className="absolute inset-x-0 top-[18px] h-[250px] touch-pan-y animate-rise-in overflow-hidden rounded-[22px] border border-line bg-surface shadow-[0_18px_40px_rgb(0_0_0/0.5)] select-none"
        >
          <Image src={match.cover} alt="" fill sizes="448px" className="pointer-events-none object-cover" />
          <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgb(10_10_10/0.15),rgb(10_10_10/0.9)_65%)]" />
          <span className="absolute top-3 left-3 flex gap-1.5">
            {countdown && (
              <span className="flex items-center gap-1 rounded-full bg-action px-2 py-[3px] text-xs font-semibold text-on-action">
                <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                {countdown}
              </span>
            )}
            {cards.length > 1 && (
              <button
                type="button"
                onClick={next}
                className="rounded-full bg-black/60 px-2 py-[3px] text-xs font-semibold text-white"
                aria-label={`Invitación ${(index % cards.length) + 1} de ${cards.length}. Ver la siguiente`}
              >
                {(index % cards.length) + 1} de {cards.length}
              </button>
            )}
          </span>
          <span className="absolute inset-x-4 bottom-3.5 flex flex-col gap-2.5 text-white">
            <span className="flex flex-col gap-0.5">
              <span className="font-display text-[25px] leading-none font-medium">
                {missing > 0 ? `Faltan ${missing}` : left === 1 ? "Queda 1 lugar" : `Quedan ${left} lugares`} · {match.fieldName}
              </span>
              <span className="text-sm opacity-85">
                {current.when} · {match.pricePesos > 0 ? `$${match.pricePesos}` : "Gratis"}
              </span>
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                onClick={dismiss}
                aria-label="Descartar invitación"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white"
              >
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
              <Link href={current.href} className="flex h-10 flex-1 items-center justify-center rounded-full bg-action text-[15px] font-semibold text-on-action">
                Unirme
              </Link>
            </span>
          </span>
        </article>
      </div>
      {more > 0 && (
        <span className="text-center text-[13px] text-muted">
          Desliza para ver {more === 1 ? "la otra invitación" : `las otras ${more} invitaciones`}
        </span>
      )}
    </div>
  );
}
