import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImpactFacts, ImpactRepository } from "./impact";

export function createImpactRepository(client: SupabaseClient): ImpactRepository {
  return {
    async factsSince(since) {
      const { data, error } = await client.rpc("agent_impact_facts", { p_since: since.toISOString() });
      if (error) throw new Error(`Unable to read agent impact (${error.code})`);
      return data as ImpactFacts;
    },
  };
}
