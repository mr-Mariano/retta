import "server-only";
import { dayKey, formatDay, formatTime, TIME_ZONE } from "@/lib/time";
import { askJson, llmConfig } from "./llm";

/**
 * Conversational search (desktop chat, 2026-11-05): turns what the person
 * writes into criteria, finds matching open matches and words a short reply.
 * Gemini reads the message when it is available; rules cover everything else.
 */

export interface Criteria {
  day?: string; // YYYY-MM-DD in Mexico City
  weekend?: boolean;
  fromHour?: number;
  toHour?: number;
  format?: "fut5" | "fut7" | "fut11";
  free?: boolean;
  maxPrice?: number;
  level?: "beginner" | "intermediate" | "advanced";
  type?: "men" | "women" | "mixed";
  place?: string;
  sort?: "soonest" | "cheapest" | "almost";
}

export interface SearchMatch {
  id: string;
  title: string;
  fieldName: string;
  area: string | null;
  cover: string;
  startsAt: string;
  pricePesos: number;
  active: number;
  min: number;
  max: number;
  pending: boolean;
  format: "fut5" | "fut7" | "fut11";
  level: "beginner" | "intermediate" | "advanced";
  type: "men" | "women" | "mixed";
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const FORMAT_LABEL = { fut5: "Fut 5", fut7: "Fut 7", fut11: "Fut 11" };
const LEVEL_LABEL = { beginner: "principiante", intermediate: "intermedio", advanced: "avanzado" };
const TYPE_LABEL = { men: "varonil", women: "femenil", mixed: "mixto" };

export function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function weekdayIndex(date: Date) {
  return WEEKDAYS.indexOf(normalize(date.toLocaleDateString("es-MX", { timeZone: TIME_ZONE, weekday: "long" })));
}

/** Reads day, hour, format, price, level, type, place and order from plain Spanish. */
export function parseRules(text: string, places: string[], now: Date): Criteria {
  const t = ` ${normalize(text)} `;
  const c: Criteria = {};

  if (/\bpasado manana\b/.test(t)) c.day = dayKey(new Date(now.getTime() + 2 * DAY_MS));
  else if (/\bhoy\b|\besta noche\b|\bahorita\b/.test(t)) c.day = dayKey(now);
  else if (/\bmanana\b/.test(t) && !/\b(en|por) la manana\b/.test(t)) c.day = dayKey(new Date(now.getTime() + DAY_MS));
  if (/\bfin( de semana)?\b|\bfinde\b/.test(t)) c.weekend = true;
  const weekday = WEEKDAYS.findIndex((name) => new RegExp(`\\b${name}\\b`).test(t));
  if (weekday >= 0 && !c.day) {
    for (let i = 0; i < 7; i++) {
      const date = new Date(now.getTime() + i * DAY_MS);
      if (weekdayIndex(date) === weekday) c.day = dayKey(date);
    }
  }

  if (/\bnoche\b/.test(t)) c.fromHour = 19;
  if (/\btarde\b/.test(t)) [c.fromHour, c.toHour] = [14, 19];
  if (/\b(en|por) la manana\b|\btemprano\b/.test(t)) [c.fromHour, c.toHour] = [6, 12];
  if (/despues del trabajo|saliendo del trabajo/.test(t)) c.fromHour = 18;
  const after = t.match(/despues de las (\d{1,2})/);
  if (after) c.fromHour = Number(after[1]) + (Number(after[1]) < 9 ? 12 : 0);
  const at = t.match(/\ba las (\d{1,2})/);
  if (at) {
    const hour = Number(at[1]) + (Number(at[1]) < 9 ? 12 : 0);
    [c.fromHour, c.toHour] = [hour, hour + 1];
  }

  const format = t.match(/\b(?:fut(?:bol)?|f)\s?(5|7|11)\b/);
  if (format) c.format = `fut${format[1]}` as Criteria["format"];
  if (/\bgratis\b|\bsin pagar\b/.test(t)) c.free = true;
  const price = t.match(/menos de \$?(\d+)/);
  if (price) c.maxPrice = Number(price[1]);
  if (/\bbarat/.test(t)) c.sort = "cheapest";
  if (/falta(n)? poco|casi (se )?arm|por armarse/.test(t)) c.sort = "almost";
  if (/principiante|tranqui|relajad/.test(t)) c.level = "beginner";
  if (/intermedio/.test(t)) c.level = "intermediate";
  if (/avanzad|competitiv/.test(t)) c.level = "advanced";
  if (/femenil|mujeres/.test(t)) c.type = "women";
  if (/varonil|hombres/.test(t)) c.type = "men";
  if (/\bmixt/.test(t)) c.type = "mixed";
  const place = places.find((name) => t.includes(` ${normalize(name)}`) || t.includes(normalize(name)));
  if (place) c.place = place;
  return c;
}

/** Asks Gemini for the same criteria; null when it is not configured or fails. */
async function parseWithModel(text: string, previous: Criteria | null, places: string[], now: Date): Promise<Criteria | null> {
  if (!llmConfig()) return null;
  const today = dayKey(now);
  const system = [
    "Extraes filtros para buscar retas de fútbol en Guadalajara a partir de lo que escribe una persona.",
    `Hoy es ${today} (${now.toLocaleDateString("es-MX", { timeZone: TIME_ZONE, weekday: "long" })}), zona horaria America/Mexico_City.`,
    `Lugares conocidos: ${places.join(", ")}.`,
    "Responde solo JSON con estas llaves opcionales: day (YYYY-MM-DD), weekend (bool), fromHour (0-23), toHour (0-23), format (fut5|fut7|fut11), free (bool), maxPrice (pesos), level (beginner|intermediate|advanced), type (men|women|mixed), place (uno de los lugares conocidos), sort (soonest|cheapest|almost).",
    "Si el mensaje refina la búsqueda anterior, conserva los filtros anteriores que no cambie. Si pide algo nuevo, empieza de cero.",
  ].join(" ");
  const user = JSON.stringify({ anterior: previous ?? {}, mensaje: text });
  try {
    const raw = await askJson<Criteria>(system, user);
    return sanitize(raw, places);
  } catch (error) {
    console.warn("[agente] chat search fell back to rules:", error instanceof Error ? error.message : error);
    return null;
  }
}

function sanitize(raw: Criteria, places: string[]): Criteria {
  const c: Criteria = {};
  if (typeof raw.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.day)) c.day = raw.day;
  if (raw.weekend === true) c.weekend = true;
  if (Number.isInteger(raw.fromHour) && raw.fromHour! >= 0 && raw.fromHour! < 24) c.fromHour = raw.fromHour;
  if (Number.isInteger(raw.toHour) && raw.toHour! > 0 && raw.toHour! <= 24) c.toHour = raw.toHour;
  if (raw.format && raw.format in FORMAT_LABEL) c.format = raw.format;
  if (raw.free === true) c.free = true;
  if (typeof raw.maxPrice === "number" && raw.maxPrice > 0) c.maxPrice = raw.maxPrice;
  if (raw.level && raw.level in LEVEL_LABEL) c.level = raw.level;
  if (raw.type && raw.type in TYPE_LABEL) c.type = raw.type;
  if (raw.place && places.includes(raw.place)) c.place = raw.place;
  if (raw.sort === "cheapest" || raw.sort === "almost" || raw.sort === "soonest") c.sort = raw.sort;
  return c;
}

/** Follow-ups ("¿y algo gratis?") keep the previous search; a message with a new day or place starts over. */
function looksLikeFollowUp(text: string) {
  return /^\s*(y|¿y|tambien|mejor|solo|ahora|y si)\b/i.test(normalize(text)) || normalize(text).split(/\s+/).length <= 3;
}

export async function understand(text: string, previous: Criteria | null, places: string[], now: Date) {
  const rules = parseRules(text, places, now);
  const base: Criteria = previous && looksLikeFollowUp(text) ? { ...previous, ...rules } : { ...rules };
  // A new day replaces the weekend and the other way around.
  if (rules.weekend) delete base.day;
  if (rules.day) delete base.weekend;
  const model = await parseWithModel(text, previous, places, now);
  const criteria = model ? { ...base, ...model } : base;
  if (criteria.day && criteria.weekend) delete criteria.weekend;
  return { criteria, engine: model ? "llm" : "rules" };
}

function matches(match: SearchMatch, c: Criteria, now: Date) {
  const start = new Date(match.startsAt);
  const hour = Number(start.toLocaleTimeString("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hour12: false }));
  if (match.active >= match.max) return false;
  if (c.day && dayKey(start) !== c.day) return false;
  if (c.weekend && ![0, 6].includes(weekdayIndex(start))) return false;
  if (c.fromHour !== undefined && hour < c.fromHour) return false;
  if (c.toHour !== undefined && hour >= c.toHour) return false;
  if (c.format && match.format !== c.format) return false;
  if (c.free && match.pricePesos > 0) return false;
  if (c.maxPrice !== undefined && match.pricePesos > c.maxPrice) return false;
  if (c.level && match.level !== c.level) return false;
  if (c.type && match.type !== c.type) return false;
  if (c.place && !normalize(`${match.fieldName} ${match.area ?? ""}`).includes(normalize(c.place))) return false;
  return start.getTime() > now.getTime();
}

export function search(all: SearchMatch[], c: Criteria, now: Date) {
  const found = all.filter((m) => matches(m, c, now));
  const missing = (m: SearchMatch) => (m.pending ? m.min - m.active : 99);
  found.sort((a, b) =>
    c.sort === "cheapest"
      ? a.pricePesos - b.pricePesos
      : c.sort === "almost"
        ? missing(a) - missing(b)
        : a.startsAt.localeCompare(b.startsAt),
  );
  return found.slice(0, 4);
}

const RELAX: { keys: (keyof Criteria)[]; label: string }[] = [
  { keys: ["free", "maxPrice"], label: "de cualquier precio" },
  { keys: ["level"], label: "de cualquier nivel" },
  { keys: ["type"], label: "de cualquier tipo" },
  { keys: ["format"], label: "de otro formato" },
  { keys: ["fromHour", "toHour"], label: "a otra hora" },
  { keys: ["place"], label: "en otra cancha" },
  { keys: ["day", "weekend"], label: "otro día" },
];

/**
 * When nothing matches, drops one filter at a time (price first, day last)
 * and says which one, so a conversation never dead-ends.
 */
export function searchOrRelax(all: SearchMatch[], c: Criteria, now: Date) {
  const exact = search(all, c, now);
  if (exact.length) return { found: exact, relaxed: null as string | null };
  let current: Criteria = { ...c };
  for (const step of RELAX) {
    if (!step.keys.some((key) => current[key] !== undefined)) continue;
    current = { ...current };
    step.keys.forEach((key) => delete current[key]);
    const found = search(all, current, now);
    if (found.length) return { found, relaxed: step.label };
  }
  return { found: [] as SearchMatch[], relaxed: null };
}

/** The criteria the agent understood, as short lines shown with a ✓ while it works. */
export function describe(c: Criteria, now: Date) {
  const lines: string[] = [];
  const when: string[] = [];
  if (c.format) when.push(FORMAT_LABEL[c.format]);
  if (c.day) when.push(formatDay(new Date(`${c.day}T12:00:00-06:00`), now).toLowerCase());
  if (c.weekend) when.push("este fin");
  if (c.fromHour !== undefined && c.toHour !== undefined && c.toHour - c.fromHour === 1) when.push(`a las ${c.fromHour}:00`);
  else if (c.fromHour !== undefined) when.push(`después de las ${c.fromHour}:00`);
  else if (c.toHour !== undefined) when.push(`antes de las ${c.toHour}:00`);
  if (when.length) lines.push(when.join(" · "));
  if (c.place) lines.push(`En ${c.place}`);
  const extra: string[] = [];
  if (c.free) extra.push("gratis");
  if (c.maxPrice) extra.push(`menos de $${c.maxPrice}`);
  if (c.level) extra.push(LEVEL_LABEL[c.level]);
  if (c.type) extra.push(TYPE_LABEL[c.type]);
  if (c.sort === "almost") extra.push("las que están por armarse");
  if (c.sort === "cheapest") extra.push("las más baratas");
  if (extra.length) lines.push(extra.join(" · ").replace(/^./, (s) => s.toUpperCase()));
  return lines.length ? lines : ["Todas las retas abiertas"];
}

/** A short reply in the agent's voice, built from the results (never invented). */
export function reply(found: SearchMatch[], c: Criteria, now: Date, relaxed: string | null = null) {
  if (found.length && relaxed) {
    const first = found[0]!;
    const start = new Date(first.startsAt);
    return `No encontré justo eso, pero hay ${found.length === 1 ? "una" : found.length} ${relaxed}. La más próxima es ${formatDay(start, now).toLowerCase()} a las ${formatTime(start)} en ${first.fieldName}.`;
  }
  if (found.length === 0) {
    return c.free || c.day || c.place
      ? "No encontré retas abiertas con eso. Prueba con otro día o quita un filtro."
      : "Por ahora no hay retas abiertas con eso.";
  }
  const first = found[0]!;
  const start = new Date(first.startsAt);
  const almost = found.filter((m) => m.pending && m.min - m.active <= 2);
  const count = found.length === 1 ? "una reta" : `${found.length} retas`;
  let text = `Encontré ${count}. La más próxima es ${formatDay(start, now).toLowerCase()} a las ${formatTime(start)} en ${first.fieldName}.`;
  if (c.sort === "cheapest") text = `Encontré ${count}; la más barata cuesta ${first.pricePesos === 0 ? "nada, es gratis" : `$${first.pricePesos}`}.`;
  if (almost.length) text += ` ${almost.length === 1 ? "A una" : `A ${almost.length}`} le${almost.length === 1 ? "" : "s"} faltan pocos para armarse.`;
  return text;
}

/** Quick replies after an answer. */
export function followUps(c: Criteria) {
  const chips = [c.weekend ? "¿Y mañana?" : "¿Y el fin de semana?"];
  if (!c.free) chips.push("Solo gratis");
  if (c.sort !== "almost") chips.push("Las que están por armarse");
  if (c.fromHour === undefined) chips.push("En la noche");
  return chips.slice(0, 3);
}
