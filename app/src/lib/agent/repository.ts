export interface MatchRow {
  id: string;
  title: string | null;
  status: "pending" | "confirmed" | "cancelled";
  min_players: number;
  max_players: number;
  confirmation_deadline: string;
  agent_enabled: boolean;
  slot: { starts_at: string; ends_at: string; field: { name: string } };
  registrations: { count: number }[];
}

export interface RunRow {
  id: string;
  match_id: string;
  passes: number;
  next_check_at: string | null;
}

export interface Candidate {
  id: string;
  same_field: number;
  same_hour: number;
  attended: number;
}

export interface MoveOption {
  slot_id: string;
  field_name: string;
  starts_at: string;
  same_field: boolean;
  affinity: number;
}

export type StepState = "done" | "running" | "queued";

export interface RescueRepository {
  runningRescues(): Promise<(RunRow & { match: MatchRow })[]>;
  pendingMatches(): Promise<MatchRow[]>;
  claimRescue(matchId: string, pass: 0 | 1): Promise<string | null>;
  finishRescue(runId: string, status: "finished" | "stopped", outcome: string | null): Promise<void>;
  savePass(runId: string, passes: number, next: string | null, engine?: string): Promise<void>;
  acceptedCount(matchId: string): Promise<{ accepted: number; invited: number }>;
  candidates(matchId: string, limit: number): Promise<Candidate[]>;
  invite(matchId: string, userId: string, reason: string, missing: number): Promise<boolean>;
  extendDeadline(matchId: string, deadline: string): Promise<string | null>;
  moveOptions(matchId: string): Promise<MoveOption[]>;
  propose(matchId: string, runId: string, slotId: string, reason: string): Promise<boolean>;
  setStep(runId: string, position: number, title: string, result: string | null, state: StepState): Promise<void>;
  updateStep(runId: string, position: number, result: string): Promise<void>;
  closeSteps(runId: string, result: string): Promise<void>;
}
export interface Inactive {
  id: string;
  last_played_at: string | null;
  fields: string[];
  usual_hour: number | null;
}

export interface OpenMatch {
  id: string;
  status: "pending" | "confirmed";
  max_players: number;
  confirmation_deadline: string;
  slot: { starts_at: string; field_id: string };
  registrations: { count: number }[];
}

export interface ReactivationRepository {
  beginReactivation(): Promise<string | null>;
  inactivePlayers(): Promise<Inactive[]>;
  openMatches(): Promise<OpenMatch[]>;
  suggest(matchId: string, player: Inactive, left: number): Promise<boolean>;
  setStep: RescueRepository["setStep"];
  finishReactivation(runId: string): Promise<void>;
}
