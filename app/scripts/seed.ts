/**
 * Resets the demo: upserts the seeded accounts, then recreates fields, slots
 * and matches for the next seven days (America/Mexico_City). Sign-ups,
 * drop-outs and cancellations go through the real RPCs, so states, payments
 * and credit come out exactly as the app would produce them.
 *
 * Deletes ALL fields, slots, matches, registrations and transactions.
 * Accounts are kept, so self-registered players survive a reset.
 *
 * Usage (from app/): npm run seed -- --yes
 * Env: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (.env.local),
 *      SUPABASE_SERVICE_ROLE_KEY and SEED_PASSWORD (.env.seed.local, never committed).
 */
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

type Role = "player" | "organizer" | "field_manager" | "admin";

interface Account {
  key: string;
  fullName: string;
  role: Role;
}

interface MatchSpec {
  field: number;
  day: number;
  time: string;
  organizer: string;
  title?: string;
  description?: string;
  min: number;
  max: number;
  pricePesos: number;
  signUps?: string[];
  dropOuts?: string[];
  cancelNote?: string;
}

const EMAIL_DOMAIN = "retta.test";
const TIME_ZONE = "America/Mexico_City";
const SLOT_TIMES = ["18:00", "19:00", "20:00", "21:00"];
const DAYS = 7;

const ACCOUNTS: Account[] = [
  { key: "admin", fullName: "Daniela Ramírez", role: "admin" },
  { key: "organizador1", fullName: "Jorge Hernández", role: "organizer" },
  { key: "organizador2", fullName: "Fernanda López", role: "organizer" },
  { key: "cancha1", fullName: "Ricardo Gómez", role: "field_manager" },
  { key: "cancha2", fullName: "Patricia Ruiz", role: "field_manager" },
  ...[
    "Ana Martínez",
    "Luis Torres",
    "Carlos Mendoza",
    "Sofía Castillo",
    "Diego Navarro",
    "Valeria Ortiz",
    "Miguel Ángel Flores",
    "Andrea Jiménez",
    "Emilio Vargas",
    "Regina Morales",
    "Santiago Cruz",
    "Mariana Reyes",
    "Pablo Herrera",
    "Camila Aguilar",
  ].map((fullName, i): Account => ({ key: `jugador${i + 1}`, fullName, role: "player" })),
];

const FIELDS = [
  {
    name: "Cancha La Estancia",
    address: "Av. Guadalupe 1450, Chapalita, Guadalajara",
    notes: "Pasto sintético · Estacionamiento gratis",
    manager: "cancha1",
  },
  {
    name: "Fut 7 Providencia",
    address: "Calle Rubén Darío 820, Providencia, Guadalajara",
    notes: "Vestidores y regaderas",
    manager: "cancha1",
  },
  {
    name: "Deportivo Tlaquepaque",
    address: "Av. Niños Héroes 300, Centro, San Pedro Tlaquepaque",
    notes: null,
    manager: "cancha2",
  },
];

/** jugador1 (Ana) is the main demo player: upcoming match, drop-out, cancellation and credit. */
const MATCHES: MatchSpec[] = [
  // Pending and closest to its minimum: the "Se está armando" card.
  { field: 0, day: 1, time: "20:00", organizer: "organizador1", title: "Reta nocturna", min: 10, max: 14, pricePesos: 80, signUps: players(2, 9) },
  { field: 1, day: 1, time: "21:00", organizer: "organizador2", min: 8, max: 12, pricePesos: 70, signUps: players(1, 10), dropOuts: ["jugador10"] },
  // Full.
  { field: 0, day: 2, time: "19:00", organizer: "organizador1", min: 6, max: 10, pricePesos: 60, signUps: players(2, 11) },
  { field: 2, day: 2, time: "20:00", organizer: "organizador2", title: "Reta gratis", description: "Trae playera clara y oscura.", min: 4, max: 10, pricePesos: 0, signUps: ["jugador3", "jugador5", "jugador7"] },
  { field: 1, day: 3, time: "20:00", organizer: "organizador1", min: 10, max: 14, pricePesos: 80 },
  { field: 0, day: 3, time: "21:00", organizer: "organizador2", min: 8, max: 12, pricePesos: 90, signUps: ["jugador1", "jugador4", "jugador6", "jugador8", "jugador12"], cancelNote: "La cancha está en mantenimiento" },
  { field: 2, day: 4, time: "19:00", organizer: "organizador1", min: 6, max: 12, pricePesos: 50, signUps: ["jugador1", "jugador13", "jugador14"], dropOuts: ["jugador1"] },
  { field: 1, day: 5, time: "19:00", organizer: "organizador2", min: 10, max: 16, pricePesos: 70, signUps: players(2, 6) },
  { field: 2, day: 6, time: "20:00", organizer: "organizador1", min: 8, max: 12, pricePesos: 80 },
];

function players(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, i) => `jugador${from + i}`);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. See the header of scripts/seed.ts.`);
  return value;
}

function emailFor(key: string): string {
  return `${key}@${EMAIL_DOMAIN}`;
}

/** Mexico City date (YYYY-MM-DD) `offset` days from today. */
function mxDate(offset: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** Mexico City has had no DST since 2022, so local time is always UTC-6. */
function mxTime(day: number, time: string): Date {
  return new Date(`${mxDate(day)}T${time}:00-06:00`);
}

function slotKey(field: number, day: number, time: string): string {
  return `${field}|${day}|${time}`;
}

/** Unwraps a Supabase response, throwing on error. */
function check<R extends { data: unknown; error: { message: string } | null }>(
  result: R,
  what: string,
): Extract<R, { error: null }>["data"] {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as Extract<R, { error: null }>["data"];
}

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("This wipes all fields, slots, matches, registrations and transactions. Re-run with --yes.");
    process.exit(1);
  }

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const password = requireEnv("SEED_PASSWORD");
  const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), noSession);

  console.log(`Seeding ${new URL(url).host}`);

  // Accounts: create missing ones, reset password, name, phone and role on existing ones.
  const { users } = check(await admin.auth.admin.listUsers({ perPage: 1000 }), "List users");
  const userIds = new Map<string, string>();

  for (const [i, account] of ACCOUNTS.entries()) {
    const email = emailFor(account.key);
    const phone = `33${String(10000000 + i)}`;
    const metadata = { full_name: account.fullName, phone };
    const existing = users.find((user) => user.email === email);

    const { user } = existing
      ? check(await admin.auth.admin.updateUserById(existing.id, { password, user_metadata: metadata }), `Update ${email}`)
      : check(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata }), `Create ${email}`);

    check(
      await admin.from("profiles").upsert({ id: user.id, full_name: account.fullName, phone, role: account.role }),
      `Profile ${email}`,
    );
    userIds.set(account.key, user.id);
  }

  // Wipe in dependency order. Stale deadline jobs remove themselves when they fire.
  for (const table of ["transactions", "registrations", "matches", "slots", "fields"]) {
    check(await admin.from(table).delete().not("id", "is", null), `Wipe ${table}`);
  }

  const fieldIds = FIELDS.map(() => crypto.randomUUID());
  check(
    await admin.from("fields").insert(
      FIELDS.map((field, i) => ({
        id: fieldIds[i],
        name: field.name,
        address: field.address,
        notes: field.notes,
        manager_id: userIds.get(field.manager),
      })),
    ),
    "Insert fields",
  );

  // Hourly slots for the next week. Skip anything too soon for the default
  // 3 h deadline to still be in the future.
  const earliest = Date.now() + 4 * 60 * 60 * 1000;
  const slotIds = new Map<string, string>();
  const slots = [];

  for (let day = 0; day < DAYS; day++) {
    for (const time of SLOT_TIMES) {
      const startsAt = mxTime(day, time);
      if (startsAt.getTime() < earliest) continue;
      for (const [field, fieldId] of fieldIds.entries()) {
        const id = crypto.randomUUID();
        slotIds.set(slotKey(field, day, time), id);
        slots.push({
          id,
          field_id: fieldId,
          starts_at: startsAt.toISOString(),
          ends_at: new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString(),
        });
      }
    }
  }
  check(await admin.from("slots").insert(slots), "Insert slots");

  // Each player acts through their own session so RLS and RPC rules apply.
  const sessions = new Map<string, SupabaseClient>();
  async function as(key: string): Promise<SupabaseClient> {
    let client = sessions.get(key);
    if (!client) {
      client = createClient(url, anonKey, noSession);
      check(await client.auth.signInWithPassword({ email: emailFor(key), password }), `Sign in ${key}`);
      sessions.set(key, client);
    }
    return client;
  }

  let created = 0;
  for (const spec of MATCHES) {
    const slotId = slotIds.get(slotKey(spec.field, spec.day, spec.time));
    if (!slotId) {
      console.warn(`Skipped match on day ${spec.day} at ${spec.time}: slot is too soon`);
      continue;
    }

    const matchId = crypto.randomUUID();
    check(
      await admin.from("matches").insert({
        id: matchId,
        slot_id: slotId,
        organizer_id: userIds.get(spec.organizer),
        title: spec.title ?? null,
        description: spec.description ?? null,
        min_players: spec.min,
        max_players: spec.max,
        price_cents: spec.pricePesos * 100,
      }),
      "Insert match",
    );
    created++;

    for (const key of spec.signUps ?? []) {
      check(await (await as(key)).rpc("sign_up_for_match", { p_match_id: matchId }), `Sign up ${key}`);
    }
    for (const key of spec.dropOuts ?? []) {
      check(await (await as(key)).rpc("drop_out_of_match", { p_match_id: matchId }), `Drop out ${key}`);
    }
    if (spec.cancelNote) {
      check(
        await (await as(spec.organizer)).rpc("cancel_match", { p_match_id: matchId, p_note: spec.cancelNote }),
        "Cancel match",
      );
    }
  }

  console.log(`Done: ${ACCOUNTS.length} accounts, ${FIELDS.length} fields, ${slots.length} slots, ${created} matches.`);
  console.log(`Accounts: ${ACCOUNTS.map((account) => emailFor(account.key)).join(", ")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
