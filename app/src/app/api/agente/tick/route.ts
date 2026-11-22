import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { reactivationTick } from "@/lib/agent/reactivation";
import { plan } from "@/lib/agent/rescue-planner";
import { rescueTick } from "@/lib/agent/rescue";
import { createAgentRepository } from "@/lib/agent/supabase-repository";

/** Wakes the agent every five minutes through private.agent_tick. */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  const secret = process.env.AGENT_CRON_SECRET;
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const repository = createAgentRepository(secret);
  const now = new Date();
  const rescue = await rescueTick(repository, now, plan);
  const reactivation = await reactivationTick(repository, now);

  revalidatePath("/", "layout");
  return NextResponse.json({ rescue, reactivation });
}

export const POST = handle;
