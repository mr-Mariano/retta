/** Matches happen in Guadalajara; every date the app shows uses this zone. */
export const TIME_ZONE = "America/Mexico_City";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar day in Mexico City as "YYYY-MM-DD", for comparing days. */
export function dayKey(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

/** "20:00" */
export function formatTime(date: Date) {
  return date.toLocaleTimeString("es-MX", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
}

/** "Hoy", "Mañana" or null for any other day. */
export function relativeDay(date: Date, now = new Date()) {
  if (dayKey(date) === dayKey(now)) return "Hoy";
  if (dayKey(date) === dayKey(new Date(now.getTime() + DAY_MS))) return "Mañana";
  return null;
}

/** "Hoy", "Mañana" or "Sáb 25 oct". */
export function formatDay(date: Date, now = new Date()) {
  const relative = relativeDay(date, now);
  if (relative) return relative;
  const weekday = date.toLocaleDateString("es-MX", { timeZone: TIME_ZONE, weekday: "short" }).replace(".", "");
  const day = date.toLocaleDateString("es-MX", { timeZone: TIME_ZONE, day: "numeric", month: "short" }).replace(".", "");
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day}`;
}

/** True on the coming Saturday or Sunday (or today, if it is the weekend). */
export function isThisWeekend(date: Date, now = new Date()) {
  const weekdayOf = (d: Date) => d.toLocaleDateString("en-US", { timeZone: TIME_ZONE, weekday: "short" });
  const keys: string[] = [];
  for (let offset = 0; offset < 7 && keys.length < 2; offset++) {
    const day = new Date(now.getTime() + offset * DAY_MS);
    const weekday = weekdayOf(day);
    if (weekday === "Sat" || weekday === "Sun") keys.push(dayKey(day));
    else if (keys.length > 0) break;
  }
  return keys.includes(dayKey(date));
}
