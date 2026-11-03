"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dayKey, mxDate, weekdayOf } from "@/lib/time";

export interface PublishState {
  error?: string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Publishes the chosen hours on the chosen weekdays for the next weeks (session 7).
 * Times already in the past or overlapping an existing slot are skipped.
 */
export async function publishSlots(fieldId: string, _prev: PublishState, formData: FormData): Promise<PublishState> {
  const weekdays = formData.getAll("weekday").map(Number);
  const times = formData.getAll("time").map(String);
  const minutes = Number(formData.get("duration"));
  const weeks = Number(formData.get("weeks"));
  if (weekdays.length === 0) return { error: "Elige al menos un día." };
  if (times.length === 0) return { error: "Elige al menos una hora." };
  if (![60, 90, 120].includes(minutes) || ![1, 2, 4].includes(weeks)) return { error: "Revisa la duración y el periodo." };

  const now = Date.now();
  const wanted: { starts: Date; ends: Date }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const day = dayKey(new Date(now + i * DAY_MS));
    if (!weekdays.includes(weekdayOf(day))) continue;
    for (const time of times) {
      const starts = mxDate(day, time);
      if (starts.getTime() <= now) continue;
      wanted.push({ starts, ends: new Date(starts.getTime() + minutes * 60 * 1000) });
    }
  }

  const supabase = await createClient();
  const last = Math.max(...wanted.map((slot) => slot.ends.getTime()), now);
  const { data: existing } = await supabase
    .from("slots")
    .select("starts_at, ends_at")
    .eq("field_id", fieldId)
    .lt("starts_at", new Date(last).toISOString())
    .gt("ends_at", new Date(now).toISOString());

  // Skip anything that overlaps an existing slot or another new one (the database rejects overlaps).
  const taken = (existing ?? []).map((slot) => [new Date(slot.starts_at).getTime(), new Date(slot.ends_at).getTime()]);
  const rows = [];
  for (const slot of wanted.sort((a, b) => a.starts.getTime() - b.starts.getTime())) {
    const [s, e] = [slot.starts.getTime(), slot.ends.getTime()];
    if (taken.some(([ts, te]) => s < te && ts < e)) continue;
    taken.push([s, e]);
    rows.push({ field_id: fieldId, starts_at: slot.starts.toISOString(), ends_at: slot.ends.toISOString() });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("slots").insert(rows);
    if (error) return { error: "No pudimos publicar los horarios. Inténtalo de nuevo." };
  }

  // Data changed: drop the browser's cached pages.
  revalidatePath("/", "layout");
  redirect(`/canchas/${fieldId}?aviso=publicados&n=${rows.length}`);
}

/** Removes a free slot; the database refuses slots with a match. */
export async function removeSlot(fieldId: string, slotId: string, day: string) {
  const supabase = await createClient();
  const { error, count } = await supabase.from("slots").delete({ count: "exact" }).eq("id", slotId);
  // Data changed: drop the browser's cached pages.
  revalidatePath("/", "layout");
  const notice = error || count === 0 ? "no-quitado" : "quitado";
  redirect(`/canchas/${fieldId}?dia=${day}&aviso=${notice}`);
}
