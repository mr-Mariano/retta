import Link from "next/link";
import { AgentMark } from "@/components/agent-mark";
import { formatTime } from "@/lib/time";
import { StopAgentButton } from "./stop-agent-button";

export interface AgentStep {
  position: number;
  title: string;
  result: string | null;
  state: "done" | "running" | "queued";
}

export interface AgentRun {
  status: "running" | "finished" | "stopped";
  outcome: string | null;
  started_at: string;
  steps: AgentStep[];
}

export interface Proposal {
  id: string;
  starts_at: string;
  field_name: string;
  reason: string;
}

/**
 * The agent working on the organizer's match, as a task list (variant B,
 * without technical details). Before it starts, a one-line note.
 */
export function AgentCard({
  matchId,
  run,
  enabled,
  proposal,
}: {
  matchId: string;
  run: AgentRun | null;
  enabled: boolean;
  proposal: Proposal | null;
}) {
  if (!run) {
    if (!enabled) return null;
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
        <AgentMark size={30} />
        <span className="flex-1 text-[13px] leading-snug text-muted">
          Si faltan jugadores una hora antes del cierre, el Agente Retta invita a jugadores afines por ti.
        </span>
        <StopAgentButton matchId={matchId} compact />
      </div>
    );
  }

  // Stopped by the organizer: the run closes on the next tick, show it as stopped now.
  const working = run.status === "running" && enabled;
  const current = run.steps.find((step) => step.state === "running");
  const subtitle = working
    ? (current?.result ?? current?.title ?? "Trabajando")
    : run.outcome === "rescued"
      ? "Tu reta se armó"
      : run.status === "stopped" || !enabled
        ? "Lo detuviste"
        : "Terminó";

  return (
    <section aria-label="Agente Retta" className="flex flex-col gap-1 rounded-[20px] border border-line bg-surface p-3.5">
      <div className="flex items-center gap-2.5">
        <AgentMark size={36} pulse={working} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[16px] font-semibold">{working ? "Agente trabajando" : "Agente Retta"}</span>
          <span className={`truncate text-[13px] ${working ? "agent-shimmer" : "text-muted"}`}>{subtitle}</span>
        </span>
        <span className="text-xs text-muted">desde {formatTime(new Date(run.started_at))}</span>
      </div>

      <ol className="mt-2 flex flex-col">
        {run.steps.map((step) => (
          <li key={step.position} className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-b-0">
            <StepIcon state={step.state} />
            <span className={`flex-1 text-[15px] font-semibold ${step.state === "queued" ? "text-muted" : ""} ${step.state === "running" ? "agent-shimmer" : ""}`}>
              {step.title}
            </span>
            {step.result && <span className="max-w-[45%] text-right text-[13px] text-muted">{step.result}</span>}
          </li>
        ))}
      </ol>

      {proposal && (
        <Link
          href={`/organizar/${matchId}?propuesta=1`}
          scroll={false}
          className="agent-glow mt-1 flex items-center gap-3 rounded-2xl p-3"
        >
          <span className="flex flex-1 flex-col">
            <span className="text-[15px] font-semibold">¿Movemos tu reta a las {formatTime(new Date(proposal.starts_at))}?</span>
            <span className="text-[13px] text-muted">{proposal.field_name}</span>
          </span>
          <span className="flex h-9 items-center rounded-full bg-action px-3.5 text-sm font-semibold text-on-action">Revisar</span>
        </Link>
      )}

      {working && <StopAgentButton matchId={matchId} />}
    </section>
  );
}

function StepIcon({ state }: { state: AgentStep["state"] }) {
  if (state === "done") {
    return (
      <span aria-label="Hecho" className="flex size-4 shrink-0 items-center justify-center rounded-full bg-action text-on-action">
        <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    );
  }
  if (state === "running") {
    return <span aria-label="En curso" className="agent-spin size-4 shrink-0 rounded-full border-2 border-line border-t-action" />;
  }
  return <span aria-label="En cola" className="size-4 shrink-0 rounded-full border-2 border-dashed border-[#34363c]" />;
}
