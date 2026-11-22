import "server-only";
import { createClient } from "@supabase/supabase-js";
import type {
  Candidate, Inactive, MatchRow, MoveOption, OpenMatch, ReactivationRepository,
  RescueRepository, RunRow, StepState,
} from "./repository";

type Arguments = Record<string, string | number | boolean | null>;

export function createAgentRepository(secret: string): RescueRepository & ReactivationRepository {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function call<T>(operation: string, args: Arguments = {}): Promise<T | null> {
    const { data, error } = await client.rpc("agent_repository", {
      p_secret: secret, p_operation: operation, p_args: args,
    });
    if (error) throw new Error(`Agent operation ${operation} failed (${error.code})`);
    return data as T | null;
  }

  return {
    runningRescues: async () => await call<(RunRow & { match: MatchRow })[]>("running_rescues") ?? [],
    pendingMatches: async () => await call<MatchRow[]>("pending_matches") ?? [],
    claimRescue: (matchId, pass) => call<string>("claim_rescue", { match_id: matchId, pass }),
    async finishRescue(runId, status, outcome) {
      await call("finish_rescue", { run_id: runId, status, outcome });
    },
    async savePass(runId, passes, next, engine) {
      await call("save_pass", { run_id: runId, passes, next, engine: engine ?? null });
    },
    acceptedCount: async (matchId) =>
      await call<{ accepted: number; invited: number }>("accepted_count", { match_id: matchId }) ?? { accepted: 0, invited: 0 },
    candidates: async (matchId, limit) => await call<Candidate[]>("candidates", { match_id: matchId, limit }) ?? [],
    invite: async (matchId, userId, reason, missing) =>
      await call<boolean>("invite", { match_id: matchId, user_id: userId, reason, missing }) ?? false,
    extendDeadline: (matchId, deadline) => call<string>("extend_deadline", { match_id: matchId, deadline }),
    moveOptions: async (matchId) => await call<MoveOption[]>("move_options", { match_id: matchId }) ?? [],
    propose: async (matchId, runId, slotId, reason) =>
      await call<boolean>("propose", { match_id: matchId, run_id: runId, slot_id: slotId, reason }) ?? false,
    async setStep(runId, position, title, result, state: StepState) {
      await call("set_step", { run_id: runId, position, title, result, state });
    },
    async updateStep(runId, position, result) {
      await call("update_step", { run_id: runId, position, result });
    },
    async closeSteps(runId, result) {
      await call("close_steps", { run_id: runId, result });
    },
    beginReactivation: () => call<string>("begin_reactivation"),
    inactivePlayers: async () => await call<Inactive[]>("inactive_players") ?? [],
    openMatches: async () => await call<OpenMatch[]>("open_matches") ?? [],
    suggest: async (matchId, player, left) => await call<boolean>("suggest", {
      match_id: matchId, user_id: player.id, last_played_at: player.last_played_at, left,
    }) ?? false,
    async finishReactivation(runId) {
      await call("finish_reactivation", { run_id: runId });
    },
  };
}
