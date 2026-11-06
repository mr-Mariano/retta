# Retta

Course project for Diseño de Software (ITESO). A platform to find and join pickup football matches on your own, with field time slots published by field managers and an AI agent that helps matches fill up.

**Live MVP:** https://retta-chi.vercel.app

## What the MVP does

Three roles, one account each (seeded for the demo):

| Role | What they can do |
|---|---|
| **Player** | Find matches by chatting with the agent ("fut 7 mañana en la noche") or browsing; join and pay with simulated money or credit; see upcoming matches and history; get notices. Any player can also **organize**: the Jugar / Organizar switch opens their organizer home, where they create matches on a published slot, follow sign-ups, remind players over WhatsApp, cancel and take attendance. |
| **Field manager** | See their fields, publish time slots in bulk, review the weekly agenda and remove free slots. |
| **Admin** | Create fields (photo, map pin, manager), change user roles and cancel any match. |

Rules the app enforces on its own:

- **Confirmation deadline.** A match is confirmed when it reaches its minimum players by the deadline; otherwise it is cancelled and everyone gets their money back as credit.
- **Credit.** It never expires, works with any organizer and appears in the transaction history.
- **Agente Retta.** An hour before the deadline of a match that is short of players, the agent invites compatible players, can extend the deadline or propose moving the match, and shows each step to the organizer. It runs every 5 minutes (Supabase `pg_cron` → `/api/agente/tick`) and uses Gemini, with rule-based fallbacks when the model is unavailable.

Phone and desktop layouts are both supported (dark mode only). Payments are simulated; no real money moves.

## Demo accounts

All accounts use the same password, which is shared with the teacher separately.

| Role | Email |
|---|---|
| Player who organizes | `organizador1@retta.test` (Jorge Hernández) |
| Field manager | `cancha1@retta.test` (Ricardo Gómez) |
| Admin | `admin@retta.test` (Daniela Ramírez) |

## Structure

- `app/`: Next.js 15 web app (App Router, TypeScript, Tailwind 4), deployed on Vercel.
- `supabase/migrations/`: database schema, row-level security, functions and scheduled jobs (Postgres on Supabase).
- `docs/decisions.md`: decision log; defines what the MVP builds and what is out of scope.
- `docs/vision/`: product vision and scope document (Spanish).
- `docs/investigacion/`: background research. Context only.
- `design/`: brand assets (logo, mascot, cover photos).

## Running locally

```bash
cd app
cp .env.example .env.local   # Supabase URL and anon key; agent keys are optional
npm install
npm run dev
```

To load the demo data, put `SUPABASE_SERVICE_ROLE_KEY` and `SEED_PASSWORD` in `app/.env.seed.local` and run `npm run seed`.

## Deployment

- **Vercel:** imported from this repository with Root Directory `app`; every push to `main` deploys.
- **Supabase:** migrations in `supabase/migrations/` are applied with `supabase db push`.
- **Environment variables:** listed in `app/.env.example`.
