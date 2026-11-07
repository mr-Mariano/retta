# Retta · guide for AI agents

Read this first if you are an AI agent reviewing, grading or working on this repository. It maps every feature to the file that implements it and says how to check it.

## What Retta is

Retta is a web app to find and join pickup football matches on your own. Field managers publish time slots, any player can organize a match on a free slot, and an AI agent helps matches reach their minimum players. UI copy is Spanish; code, comments and docs are English.

- **Live app:** https://retta-chi.vercel.app (phone and desktop layouts, dark mode)
- **Scope source of truth:** `docs/decisions.md` (dated decision log). `docs/vision/Retta_Documento_de_vision.docx` is the original Vision and Scope document.
- **Scope change vs. the vision document:** the vision defined four roles. On 2026-11-06 the organizer role was merged into player, so any player can organize. Three roles remain: `player`, `field_manager` and `admin`. This change is recorded in `docs/decisions.md` and `supabase/migrations/20261106200000_players_organize.sql`.

## Features and where they live

Routes are under `app/src/app/`. `(tabs)` is a route group (it is not part of the URL).

| Feature | URL | Code |
|---|---|---|
| Welcome, sign up, sign in | `/`, `/registro`, `/entrar` | `page.tsx`, `registro/`, `entrar/`, `components/auth-split.tsx` |
| Find matches by chatting with the agent | `/explorar` | `(tabs)/explorar/chat-search.tsx`, `chat-actions.ts`, `lib/agent/search.ts` |
| Match detail, join and simulated payment | `/retas/[id]` | `retas/[id]/page.tsx`; database function `sign_up_for_match` |
| My matches (upcoming and history) | `/mis-retas` | `(tabs)/mis-retas/page.tsx` |
| Notices (invites, confirmations) | `/avisos` | `avisos/`, `components/avisos-popover.tsx`, `lib/notices.ts` |
| Balance (credit) and transactions | `/saldo` | `(tabs)/saldo/page.tsx`; function `my_balance` |
| Jugar / Organizar switch | sidebar and Explorar | `components/mode-switch.tsx`, `lib/mode.ts` |
| Organizer home | `/organizar` | `(tabs)/organizar/page.tsx`, `lib/organized.ts` |
| Create a match | `/organizar/nueva` | `organizar/nueva/create-flow.tsx`, `organizar/actions.ts` |
| Manage a match, WhatsApp reminders, cancel | `/organizar/[id]` | `organizar/[id]/page.tsx`; function `cancel_match` |
| Attendance | `/organizar/[id]/asistencia` | `organizar/[id]/asistencia/` |
| Organizer's matches with agent status | `/perfil/organizar` | `(tabs)/perfil/organizar/page.tsx` |
| Field manager: fields, agenda, publish slots | `/perfil/canchas`, `/canchas/[id]`, `/canchas/[id]/publicar` | `(tabs)/perfil/canchas/`, `canchas/` |
| Admin: home, fields, users, matches | `/admin`, `/admin/canchas`, `/admin/usuarios`, `/admin/retas` | `(tabs)/admin/`, `admin/actions.ts`; function `set_user_role` |
| Admin: new field with photo and map pin | `/admin/canchas/nueva` | `admin/canchas/nueva/new-field-flow.tsx` |
| Profile | `/perfil` | `(tabs)/perfil/page.tsx` |

## Rules enforced by the system

- **Confirmation deadline.** When a match is created, a per-match `pg_cron` job (`deadline-<match id>`) runs at its deadline. It confirms the match if it reached the minimum players; otherwise it cancels the match and refunds everyone as credit. See `supabase/migrations/20261102120000_initial_schema.sql`.
- **Credit** never expires and works with any organizer (`transactions` table, `my_balance`).
- **Permissions** are enforced in Postgres with row-level security, not only in the UI. Each policy is in the migrations.
- **Agente Retta (rescue).** `pg_cron` job `agent-tick` runs every 5 minutes and calls `/api/agente/tick` (`app/src/app/api/agente/tick/route.ts`). One hour before the deadline of a match short of players, the agent:
  - invites compatible players (`agent_candidates`);
  - can extend the deadline (`agent_extend_deadline`);
  - can propose moving the match (`move_proposals`);
  - logs every step in `agent_runs` and `agent_steps`, which the organizer sees live.

  It uses Gemini through an OpenAI-compatible API, with one retry, a fallback model and rule-based fallbacks (`app/src/lib/agent/llm.ts`, `rescue.ts`, `reactivation.ts`).

## Data model

`profiles` (role) → `fields` (manager) → `slots` → `matches` (organizer) → `registrations` (player) → `transactions`. Agent tables: `agent_runs`, `agent_steps`, `notices`, `move_proposals`. Full schema: `supabase/migrations/` in date order.

## Using the live app as an agent

- **Demo accounts:**
  - Player who also organizes: `organizador1@retta.test`
  - Field manager: `cancha1@retta.test`
  - Admin: `admin@retta.test`
- **Password:** shared with the teacher outside the repository.
- **Payments are simulated.** The "Pagar … (prueba)" button moves no real money.
- **Selectors:** controls have Spanish accessible names. For example, the sign-in form uses `#email` and `#password`, the mode switch is a group named "Modo" with buttons "Jugar" and "Organizar", and the main navigation uses `aria-label` names ("Navegación principal", "Secciones").
- **Machine-readable summary:** https://retta-chi.vercel.app/llms.txt (source: `app/public/llms.txt`).
- **Scripted walkthrough:** `demo/record.py` (Playwright) drives the main flow of every role. It is the script used for the demo video.

## Working on the code

```bash
cd app
npm install
npm run dev     # needs app/.env.local (see app/.env.example)
npx tsc --noEmit && npm run lint && npm run build
```

- Schema changes go in new files under `supabase/migrations/` and are applied with `supabase db push`.
- Vercel deploys every push to `main` (Root Directory `app`).
- Never commit `.env*` files except `.env.example`.
