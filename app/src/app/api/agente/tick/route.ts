import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { reactivationTick } from "@/lib/agent/reactivation";
import { rescueTick } from "@/lib/agent/rescue";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Wakes the agent. pg_cron calls it every 5 minutes (private.agent_tick).
 * For demos: ?reta=<match id> runs that match's next pass right away, and
 * ?reactivar=1 sends this week's suggestions again.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  const secret = process.env.AGENT_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const db = createAdminClient();
  const now = new Date();
  const rescue = await rescueTick(db, now, params.get("reta") ?? undefined);
  const reactivation = await reactivationTick(db, now, params.get("reactivar") === "1");

  revalidatePath("/", "layout");
  return NextResponse.json({ rescue, reactivation });
}

export const GET = handle;
export const POST = handle;
