"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { AgentMark } from "@/components/agent-mark";
import type { Criteria, SearchMatch } from "@/lib/agent/search";
import { askAgent, type ChatAnswer } from "./chat-actions";
import { PanelLink } from "./panel-link";

export interface TodayMatch {
  id: string;
  title: string;
  cover: string;
  time: string;
  note: string;
  price: string;
}

type Turn = { role: "me"; text: string } | { role: "agent"; answer: ChatAnswer | null; error?: boolean };

const THINKING = ["Leyendo lo que buscas…", "Buscando retas abiertas…", "Revisando cupo y horarios…"];
const TIME = new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * Desktop Explorar as a conversation with the agent (chat A, start B1 + B2,
 * 2026-11-05): the agent greets, you write what you want, it shows what it
 * understood while it searches and answers with matches you can join.
 */
export function ChatSearch({ greeting, chips, today, heading }: { greeting: string; chips: string[]; today: TodayMatch[]; heading: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setDraft("");
    setTurns((list) => [...list, { role: "me", text: message }, { role: "agent", answer: null }]);
    startTransition(async () => {
      try {
        // Keep the thinking animation on screen long enough to read, even when rules answer instantly.
        const [answer] = await Promise.all([askAgent(message, criteria), new Promise((resolve) => setTimeout(resolve, 900))]);
        setCriteria(answer.criteria);
        setTurns((list) => [...list.slice(0, -1), { role: "agent", answer }]);
      } catch {
        setTurns((list) => [...list.slice(0, -1), { role: "agent", answer: null, error: true }]);
      }
    });
  }

  const composer = <Composer value={draft} onChange={setDraft} onSend={() => send(draft)} busy={pending} />;

  if (turns.length === 0) {
    return (
      <section className="hidden min-h-[calc(100dvh-120px)] flex-col justify-center gap-6 lg:flex">
        <div className="flex items-start gap-3">
          <AgentMark size={36} />
          <div className="flex flex-1 flex-col gap-3 pt-1">
            <p className="text-[18px] leading-relaxed">{greeting}</p>
            <QuickReplies chips={chips} onPick={send} />
          </div>
        </div>
        {composer}
        {today.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <h2 className="text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">{heading}</h2>
            <ul className="grid grid-cols-3 gap-3">
              {today.map((match) => (
                <li key={match.id}>
                  <PanelLink matchId={match.id} className="flex flex-col overflow-hidden rounded-[6px] border border-line bg-surface">
                    <span className="relative h-24 bg-elevated">
                      <Image src={match.cover} alt="" fill sizes="220px" className="object-cover" />
                    </span>
                    <span className="flex flex-col gap-0.5 px-3 py-2.5">
                      <span className="truncate text-[15px] font-semibold">{match.title}</span>
                      <span className="truncate text-[13px] text-muted">
                        {match.time} · {match.note} · {match.price}
                      </span>
                    </span>
                  </PanelLink>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="hidden min-h-[calc(100dvh-120px)] flex-col lg:flex">
      <div className="flex flex-1 flex-col gap-6 pb-6">
        {turns.map((turn, i) =>
          turn.role === "me" ? (
            <p key={i} className="max-w-[460px] self-end rounded-[8px_8px_2px_8px] bg-elevated px-4 py-3 text-[16px]">
              {turn.text}
            </p>
          ) : (
            <AgentTurn key={i} turn={turn} last={i === turns.length - 1} onPick={send} />
          ),
        )}
        <div ref={bottom} />
      </div>
      <div className="sticky bottom-0 flex flex-col gap-1.5 bg-base pt-2 pb-6">
        {composer}
        <span className="text-center text-xs text-muted">El agente busca en las retas publicadas; tú decides a cuál unirte.</span>
      </div>
    </section>
  );
}

function AgentTurn({ turn, last, onPick }: { turn: Extract<Turn, { role: "agent" }>; last: boolean; onPick: (text: string) => void }) {
  const answer = turn.answer;
  if (turn.error) {
    return (
      <div className="flex items-start gap-3">
        <AgentMark size={32} />
        <p className="pt-1 text-[16px]">No pude buscar en este momento. Intenta otra vez.</p>
      </div>
    );
  }
  if (!answer) return <Thinking />;
  return (
    <div className="flex items-start gap-3">
      <AgentMark size={32} />
      <div className="flex flex-1 flex-col gap-3 pt-1">
        <Steps steps={answer.steps} />
        <p className="animate-rise-in text-[16px] leading-relaxed">{answer.text}</p>
        {answer.matches.length > 0 && (
          <ul className="flex animate-rise-in flex-col gap-2">
            {answer.matches.map((match) => (
              <li key={match.id}>
                <ResultRow match={match} />
              </li>
            ))}
          </ul>
        )}
        {last && <QuickReplies chips={answer.chips} onPick={onPick} />}
      </div>
    </div>
  );
}

/** While the agent works: the avatar breathes and a shimmering line says what it is doing. */
function Thinking() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((value) => Math.min(value + 1, THINKING.length - 1)), 1100);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="flex items-start gap-3" role="status">
      <AgentMark size={32} pulse />
      <div className="flex flex-1 flex-col gap-3 pt-1.5">
        <span key={index} className="agent-shimmer animate-fade-in text-[16px] font-semibold">
          {THINKING[index]}
        </span>
        <span className="flex items-center gap-3 rounded-[6px] border border-line p-2.5">
          <span className="bone size-14 shrink-0 rounded-[4px]" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="bone h-3.5 w-1/2 rounded-[3px]" />
            <span className="bone h-3 w-1/3 rounded-[3px]" />
          </span>
        </span>
      </div>
    </div>
  );
}

/** What the agent understood, revealed one line at a time with a ✓. */
function Steps({ steps }: { steps: string[] }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= steps.length) return;
    const timer = window.setTimeout(() => setShown((value) => value + 1), 180);
    return () => window.clearTimeout(timer);
  }, [shown, steps.length]);
  return (
    <ul className="flex flex-col gap-1.5">
      {steps.slice(0, shown).map((step) => (
        <li key={step} className="flex animate-fade-in items-center gap-2 text-sm text-muted">
          <span className="flex size-4 items-center justify-center rounded-full bg-action text-on-action">
            <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          {step}
        </li>
      ))}
    </ul>
  );
}

function ResultRow({ match }: { match: SearchMatch }) {
  const missing = match.min - match.active;
  const note = match.pending ? (missing === 1 ? "falta 1" : `faltan ${missing}`) : `quedan ${match.max - match.active}`;
  return (
    <PanelLink matchId={match.id} className="flex items-center gap-3 rounded-[6px] border border-line bg-surface p-2.5 hover:border-ink/30">
      <span className="relative size-16 shrink-0 overflow-hidden rounded-[4px] bg-elevated">
        <Image src={match.cover} alt="" fill sizes="64px" className="object-cover" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[16px] font-semibold">{match.title}</span>
        <span className="truncate text-sm text-muted">
          {TIME.format(new Date(match.startsAt))} · {match.fieldName} · <span className={match.pending ? "text-action" : ""}>{note}</span>
        </span>
      </span>
      <span className="text-[18px] font-bold">{match.pricePesos === 0 ? "Gratis" : `$${match.pricePesos}`}</span>
      <span className="flex h-9 items-center rounded-[6px] bg-action px-4 text-sm font-semibold text-on-action">Unirme</span>
    </PanelLink>
  );
}

function QuickReplies({ chips, onPick }: { chips: string[]; onPick: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onPick(chip)}
          className="pending-button h-9 rounded-[6px] border border-line px-3.5 text-sm font-semibold text-ink/85 hover:border-ink/40"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

function Composer({ value, onChange, onSend, busy }: { value: string; onChange: (value: string) => void; onSend: () => void; busy: boolean }) {
  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
      className="flex items-center gap-2.5 rounded-[8px] border border-line bg-surface py-2.5 pr-2.5 pl-5 shadow-[0_10px_30px_rgb(0_0_0/0.35)] focus-within:border-ink/40"
    >
      <label htmlFor="buscar" className="sr-only">
        Escribe qué quieres jugar
      </label>
      <input
        id="buscar"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ej. fut 7 mañana en la noche, cerca de Providencia"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-[17px] text-ink placeholder:text-muted focus:outline-none"
      />
      <button
        type="submit"
        disabled={busy || !value.trim()}
        aria-label="Enviar"
        className="pending-button flex size-10 shrink-0 items-center justify-center rounded-[6px] bg-action text-on-action disabled:opacity-40"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </form>
  );
}
