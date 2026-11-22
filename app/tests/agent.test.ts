import assert from "node:assert/strict";
import { test } from "node:test";
import { loadImpact } from "../src/lib/agent/impact.ts";
import { reactivationTick } from "../src/lib/agent/reactivation.ts";
import type { MatchRow, ReactivationRepository, RescueRepository } from "../src/lib/agent/repository";
import { rescueTick, type RescuePlanner } from "../src/lib/agent/rescue.ts";

const now = new Date("2026-11-22T22:00:00Z");
const match: MatchRow = {
  id: "match",
  title: null,
  status: "pending",
  min_players: 6,
  max_players: 10,
  confirmation_deadline: "2026-11-22T22:30:00Z",
  agent_enabled: true,
  registrations: [{ count: 5 }],
  slot: {
    starts_at: "2026-11-23T01:00:00Z",
    ends_at: "2026-11-23T02:00:00Z",
    field: { name: "Test Field" },
  },
};

const rules: RescuePlanner = async (_, _actions, _missing, fallback) => {
  await fallback();
  return "rules";
};

function rescueRepository(overrides: Partial<RescueRepository>): RescueRepository {
  return {
    runningRescues: async () => [],
    pendingMatches: async () => [match],
    claimRescue: async () => "run",
    acceptedCount: async () => ({ accepted: 0, invited: 0 }),
    candidates: async () => [{ id: "candidate", same_field: 1, same_hour: 0, attended: 1 }],
    invite: async () => true,
    extendDeadline: async (_, deadline) => deadline,
    setStep: async () => {},
    savePass: async () => {},
    moveOptions: async () => [],
    propose: async () => false,
    finishRescue: async () => {},
    updateStep: async () => {},
    closeSteps: async () => {},
    ...overrides,
  };
}

test("rescue invites a compatible player and records the next pass", async () => {
  const invited: string[] = [];
  const saved: unknown[] = [];
  const repository = rescueRepository({
    async invite(matchId, playerId) {
      assert.equal(matchId, match.id);
      invited.push(playerId);
      return true;
    },
    async savePass(...pass) { saved.push(pass); },
  });
  assert.deepEqual((await rescueTick(repository, now, rules)).started, [match.id]);
  assert.deepEqual(invited, ["candidate"]);
  assert.deepEqual(saved, [["run", 1, "2026-11-22T22:30:00.000Z", "rules"]]);
});

test("a pass already claimed by another request sends no invitations", async () => {
  const repository = rescueRepository({
    claimRescue: async () => null,
    invite: async () => assert.fail("Unclaimed pass invited a player"),
  });
  assert.deepEqual((await rescueTick(repository, now, rules)).started, []);
});

test("a second pass proposes an eligible alternative without moving the match", async () => {
  const proposed: string[] = [];
  const repository = rescueRepository({
    runningRescues: async () => [{ id: "run", match_id: match.id, passes: 1, next_check_at: now.toISOString(), match }],
    moveOptions: async () => [{
      slot_id: "another",
      field_name: "Test Field",
      starts_at: "2026-11-23T00:30:00Z",
      affinity: 2,
      same_field: true,
    }],
    async propose(_, runId, slotId) {
      assert.equal(runId, "run");
      proposed.push(slotId);
      return true;
    },
  });
  assert.deepEqual((await rescueTick(repository, now, rules)).rechecked, [match.id]);
  assert.deepEqual(proposed, ["another"]);
});

test("reactivation suggests an open match to an inactive player", async () => {
  const player = { id: "inactive", fields: ["field"], last_played_at: null, usual_hour: 19 };
  const repository: ReactivationRepository = {
    beginReactivation: async () => "run",
    inactivePlayers: async () => [player],
    openMatches: async () => [{ ...match, status: "pending", slot: { ...match.slot, field_id: "field" } }],
    setStep: async () => {},
    finishReactivation: async () => {},
    async suggest(matchId, recipient, placesLeft) {
      assert.equal(matchId, match.id);
      assert.equal(recipient.id, player.id);
      assert.equal(placesLeft, 5);
      return true;
    },
  };
  assert.deepEqual(await reactivationTick(repository, now), { sent: 1, skipped: false });
});

test("impact reports confirmed attendance separately from upcoming sign-ups", async () => {
  const impact = await loadImpact({
    factsSince: async () => ({
      outcomes: ["rescued", "not_rescued"],
      matches: [
        { startsAt: "2026-11-22T20:00:00Z", endsAt: "2026-11-22T21:00:00Z", active: 6, present: 2, returning: ["player"] },
        { startsAt: "2026-11-23T01:00:00Z", endsAt: "2026-11-23T02:00:00Z", active: 6, present: 0, returning: [] },
      ],
    }),
  }, now);
  assert.deepEqual(impact, { saved: 1, notRescued: 1, returning: 1, played: 120, scheduled: 360 });
});
