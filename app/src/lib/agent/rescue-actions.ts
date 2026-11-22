import { formatTime } from "../time.ts";
import type { Candidate, MatchRow, MoveOption, RescueRepository, StepState } from "./repository";

export const MAX_INVITES = 10;

export const STEP = { review: 1, search: 2, invite: 3, extend: 4, wait: 5, move: 6, end: 7 } as const;

export class RescueActions {
  deadline: string;
  proposed = false;
  private found = new Map<string, Candidate>();
  private options_: MoveOption[] = [];
  /** Invited in earlier passes; search no longer returns them, so they count toward "encontrados". */
  private readonly invitedBefore: number;

  private readonly repository: RescueRepository;
  private readonly match: MatchRow;
  private readonly steps: Steps;
  private readonly runId: string;
  private readonly missing: number;
  private invited: number;

  constructor(repository: RescueRepository, match: MatchRow, steps: Steps, runId: string, missing: number, invited = 0) {
    this.repository = repository;
    this.match = match;
    this.steps = steps;
    this.runId = runId;
    this.missing = missing;
    this.invited = invited;
    this.deadline = match.confirmation_deadline;
    this.invitedBefore = invited;
  }

  private get title() {
    return this.match.title ?? `Reta en ${this.match.slot.field.name}`;
  }

  situation() {
    const active = this.match.registrations[0]?.count ?? 0;
    return JSON.stringify({
      reta: this.title,
      cancha: this.match.slot.field.name,
      empieza: this.match.slot.starts_at,
      cierre: this.deadline,
      inscritos: active,
      minimo: this.match.min_players,
      maximo: this.match.max_players,
      faltan: this.missing,
      ya_invitados: this.invited,
      max_invitaciones: MAX_INVITES - this.invited,
    });
  }

  async search(limit: number) {
    const list = await this.repository.candidates(this.match.id, Math.min(Math.max(Math.trunc(limit), 1), MAX_INVITES));
    list.forEach((c) => this.found.set(c.id, c));
    await this.steps.set(STEP.search, "Buscar jugadores afines", `${this.invitedBefore + this.found.size} encontrados`, "done");
    return list;
  }

  async invite(ids: string[]) {
    const budget = MAX_INVITES - this.invited;
    const chosen = ids.filter((id) => this.found.has(id)).slice(0, Math.max(budget, 0));
    let sent = 0;
    for (const id of chosen) {
      const candidate = this.found.get(id)!;
      if (await this.repository.invite(this.match.id, id, this.reason(candidate), this.missing)) sent++;
    }
    this.invited += sent;
    if (this.invited > 0) {
      await this.steps.set(STEP.invite, `Invitar a ${this.invited}`, "Les llegó un aviso", "done");
    }
    return { invitados: sent };
  }

  async extend() {
    const start = new Date(this.match.slot.starts_at).getTime();
    const latest = new Date(start - 60 * 60 * 1000);
    const current = new Date(this.deadline);
    if (latest.getTime() <= current.getTime()) return { extendido: false, motivo: "ya_es_el_maximo" };
    const deadline = await this.repository.extendDeadline(this.match.id, latest.toISOString());
    if (!deadline) return { extendido: false };
    this.deadline = deadline;
    await this.steps.set(STEP.extend, "Extender cierre", `${formatTime(current)} → ${formatTime(new Date(this.deadline))}`, "done");
    return { extendido: true, cierre: this.deadline };
  }

  async options() {
    this.options_ = await this.repository.moveOptions(this.match.id);
    return this.options_;
  }

  async propose(slotId: string, reason: string) {
    const option = this.options_.find((o) => o.slot_id === slotId);
    if (!option || this.proposed) return { propuesto: false };
    if (!await this.repository.propose(this.match.id, this.runId, slotId, reason)) return { propuesto: false };
    this.proposed = true;
    await this.steps.set(STEP.move, "Proponer otro horario", `${formatTime(new Date(option.starts_at))} en ${option.field_name}`, "done");
    return { propuesto: true };
  }

  private reason(c: Candidate) {
    if (c.same_field > 0) return `Juegas seguido en ${this.match.slot.field.name}`;
    if (c.same_hour > 0) return "Sueles jugar a esta hora";
    return "Estás libre a esa hora";
  }
}

/** Updates the fixed positions shown in the organizer’s run log. */
export class Steps {
  private readonly repository: RescueRepository;
  private readonly runId: string;

  constructor(repository: RescueRepository, runId: string) {
    this.repository = repository;
    this.runId = runId;
  }

  set(position: number, title: string, result: string | null, state: StepState) {
    return this.repository.setStep(this.runId, position, title, result, state);
  }

  update(position: number, result: string) {
    return this.repository.updateStep(this.runId, position, result);
  }

  closeOpen(result: string) {
    return this.repository.closeSteps(this.runId, result);
  }
}
