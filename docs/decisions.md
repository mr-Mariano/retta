# Decision Log

Record of decisions made during design sessions for the Retta MVP. Each session appends a new section. The product vision (`docs/vision/`) remains the reference for the full scope; this log defines what is actually being built.

## Session 1 — MVP scope and foundations (2026-10-23)

| Date | Decision | Notes |
|---|---|---|
| 2026-10-23 | MVP delivered in 1 week as a controlled demo | Seeded data and test accounts per role; not a real pilot |
| 2026-10-23 | Functional slice: field → time slot → public match → sign-up and payment → automatic confirmation or cancellation → attendance | Complete flows take priority over additional features |
| 2026-10-23 | Out of MVP scope: waitlist, refunds, private matches (access code), approval workflows, incident reports, email, tournaments | Remain in the vision as later phases. Reusable credit was moved into scope in session 2 |
| 2026-10-23 | Simulated payment inside Retta ("Pay (test)") with a transaction history | Data model prepared to plug in a real provider later |
| 2026-10-23 | Four roles: player, organizer (also acts as host), field manager, admin | No referee or captain in MVP |
| 2026-10-23 | Field managers publish time slots; admin creates fields and assigns managers | Organizers book a slot when creating a match; no overlaps |
| 2026-10-23 | Players self-register; admin, organizer and field manager accounts are seeded | Minimal admin panel to change roles |
| 2026-10-23 | Stack: Next.js (TypeScript) + Supabase + Vercel | |
| 2026-10-23 | Git repository at `retta/`, private GitHub repo connected to Vercel | Automatic deploy on push |
| 2026-10-23 | Figma file organized in 7 pages: 00 Decisions · 01 Foundations · 02 Flows · 03–06 one per role | |
| 2026-10-23 | Base visual identity designed in Claude Design → approval → Figma `01 · Fundamentos`, at the start of session 4 | Preceded by a round of questions on visual preferences |
| 2026-10-23 | Process: grill-me per topic → proposal in Claude Design → approval → Figma | Session order: scope, business rules and states, data model, screens, implementation |
| 2026-10-23 | Codebase documentation is written in English | Product UI stays in Spanish |

### Open items
- Business rules with concrete values: default confirmation deadline, drop-outs, attendance code (session 2)
- States for match, registration and payment (session 2)
- Data model (session 3)
- Visual preferences and base identity (session 4)
- Assumption: the course does not mandate a specific technology

## Session 2 — Business rules and states (2026-10-23)

| Date | Decision | Notes |
|---|---|---|
| 2026-10-23 | Sign-up and payment are a single atomic action; no 10-minute hold | Rejected if the match is full |
| 2026-10-23 | Players may drop out only before the confirmation deadline, receiving 100% as credit | After the deadline the spot is fixed |
| 2026-10-23 | If a drop-out leaves a confirmed match below the minimum, it returns to `pending` | Can only happen before the deadline |
| 2026-10-23 | A player who dropped out may sign up again if there is space | |
| 2026-10-23 | Every return of money (drop-out or match cancellation) is recorded as credit | **Reusable credit is now in MVP scope** (changes session 1); refunds remain out |
| 2026-10-23 | Credit is applied automatically at sign-up; any remainder is covered by a simulated payment; a breakdown is shown before confirming | |
| 2026-10-23 | Credit never expires, cannot be withdrawn or transferred, works with any organizer, and is visible in the transaction history | |
| 2026-10-23 | Confirmation deadline set by the organizer: default 3 h before start; same day and at least 1 h before start | |
| 2026-10-23 | A match is confirmed as soon as it reaches the minimum; sign-ups stay open until full or until start | |
| 2026-10-23 | Organizers can cancel their match before start with a mandatory reason; admins can cancel any match | |
| 2026-10-23 | A match is editable only while it has no sign-ups | Afterwards it can only be cancelled |
| 2026-10-23 | Field managers publish fixed time slots; a match takes the whole slot; no field cost in MVP | |
| 2026-10-23 | Attendance is marked by the organizer from start until 24 h later; no consequences | Used only for metrics (attendance, recurrence) |
| 2026-10-23 | Capacity: 2 ≤ min ≤ max ≤ 30; no game-format field | |
| 2026-10-23 | Price in whole MXN, ≥ 0; free matches are allowed | Free sign-ups create no transactions and drop-outs give no credit; UI shows "Sign up" with no payment step |
| 2026-10-23 | Organizers may sign up for their own match | They pay like any other player |
| 2026-10-23 | Match states: `pending` · `confirmed` · `cancelled` (reason: `minimum_not_reached`, `organizer`, `admin`, plus optional text) | "In progress" and "Played" are derived from time, not stored |
| 2026-10-23 | Registration states: `active` · `dropped` · `match_cancelled`; attendance is a separate field (`unrecorded`, `present`, `absent`) | Attendance editable only on active registrations of confirmed matches, within the 24 h window |
| 2026-10-23 | No payment states: immutable transactions `charge`, `credit_used`, `credit_dropout`, `credit_cancellation` linked to the registration | Balance = credits − credit used |
| 2026-10-23 | Slot availability (`available`/`booked`) is derived from its matches; a slot is released when its match is cancelled; only available slots can be deleted | One non-cancelled match per slot, enforced by the database |

### Open items
- Mechanism for automatic cancellation at the confirmation deadline (session 3)
- Full data model (session 3)

## Session 3 — Data model (2026-10-23)

Entities: `profiles` (user) → `fields` (manager) → `slots` → `matches` (organizer) → `registrations` (player) → `transactions`.

| Date | Decision | Notes |
|---|---|---|
| 2026-10-23 | Six entities: profiles, fields, slots, matches, registrations, transactions | A field has many slots; a slot has at most one non-cancelled match; a match has many registrations; a registration has zero or more transactions |
| 2026-10-23 | One role per user (`player`, `organizer`, `field_manager`, `admin`); any role can sign up as a player | |
| 2026-10-23 | Exactly one manager per field; a manager may have several fields | `fields.manager_id` |
| 2026-10-23 | Field data: name, address, optional notes; no photos or map | For now; may be extended |
| 2026-10-23 | Profile data: full name, email (from auth) and **mandatory phone** (10-digit Mexican number) | |
| 2026-10-23 | Organizers get a "Remind via WhatsApp" button per player that opens WhatsApp with a prefilled message | Automated reminders are out of MVP scope |
| 2026-10-23 | Match: optional title (default "Reta en {field}") and optional description | |
| 2026-10-23 | Sign-up, drop-out and match cancellation are Postgres functions called from Next.js, using row locks | Everything else uses regular queries protected by RLS |
| 2026-10-23 | Automatic cancellation: one pg_cron job per match (`deadline-<match id>`) scheduled at its exact confirmation deadline | Rescheduled when the deadline is edited, removed on manual cancellation or after running. Accepted risk: a lost job leaves the match `pending`; covered by a dedicated test |
| 2026-10-23 | Balance is computed from transactions (no stored column); the sign-up function locks the player's profile while computing and using it | |
| 2026-10-23 | Amounts stored as integer cents | UI accepts whole pesos only |
| 2026-10-23 | Timestamps stored as `timestamptz` (UTC) and always displayed in `America/Mexico_City` | |
| 2026-10-23 | Registrations store who last marked attendance and when (`attendance_marked_by`, `attendance_marked_at`) | No full audit history |

### Proposed fields
- `profiles`: id (auth user), full_name, phone, role
- `fields`: id, name, address, notes, manager_id → profiles
- `slots`: id, field_id → fields, starts_at, ends_at
- `matches`: id, slot_id → slots, organizer_id → profiles, title, description, min_players, max_players, price_cents, confirmation_deadline, status, cancel_reason, cancel_note
- `registrations`: id, match_id → matches, player_id → profiles, status, attendance, attendance_marked_by → profiles, attendance_marked_at, created_at
- `transactions`: id, registration_id → registrations, type, amount_cents, created_at

### Open items
- Session 4: visual preferences → base identity in Claude Design → approval → Figma `01 · Fundamentos`; then screens per role

## Session 4 — Visual identity (2026-10-23)

Canvas: Claude Design "Retta · Identidad base". Figma: `01 · Fundamentos` (variables, text styles, components).

| Date | Decision | Notes |
|---|---|---|
| 2026-10-23 | Design principles: precision and whitespace (Vercel/Uber), celebration moments (Duolingo), trustworthy cards (Airbnb) | Principles, not visual copies |
| 2026-10-23 | Visual reference: dark event app from the shared Dribbble video | Image-led cards, price pill over photo, floating nav |
| 2026-10-23 | Neutral palette, Codex-like; no brand primary color for now | Each component (toasts, labels, states) will get its own style later |
| 2026-10-23 | Dark mode is the primary mode; light mode designed from the start | Tokens in Figma collection `Color` with modes `Oscuro` / `Claro` |
| 2026-10-23 | Dark: bg `#181818`, surface `#212121`, elevated `#2A2A2A`, border `#303030`, text `#ECECEC`, secondary `#A3A3A3` | |
| 2026-10-23 | Light: bg `#FFFFFF`, surface `#F4F4F4`, border `#E3E3E3`, text `#0D0D0D`, secondary `#5D5D5D` | |
| 2026-10-23 | Primary actions use inverted text color (light on dark, dark on light) | |
| 2026-10-23 | Typography: Big Shoulders Display ExtraBold (titles, prices, numbers) + Geist (body, buttons) | Text styles `Display/*`, `Body/*`, `Label/*` in Figma |
| 2026-10-23 | Mobile-first | |
| 2026-10-23 | Floating bottom nav, 56 px tall; active section expands into a labeled pill | Sections: Explorar, Mis retas, Saldo, Perfil |
| 2026-10-23 | Real match photos on covers, with a light dark scrim under overlaid text | Current set in `design/photos/` (pro stadiums with visible brands: replace with amateur photos before any public pilot) |
| 2026-10-23 | **Each field has a cover image** chosen by the admin from a bundled set (no uploads); matches inherit it | Changes session 3 (fields had no images): add `fields.cover_image` |
| 2026-10-23 | Tone: Spanish, "tú", friendly; football flavor only in celebration moments, plain language for payments and errors | |
| 2026-10-23 | Logo: wordmark 02 "Línea de cancha" (Big Shoulders 800 R with a pitch-line cut) | Files in `design/logo/`; check the cut at 32 px, consider a thicker cut for small icon sizes |
| 2026-10-23 | Mascot: blue football whistle with orange top cap and keyring; four poses with understated, natural expressions (welcome, celebration, waiting, mild sadness) | Approved source: `design/mascot/silbato-poses.png`; separate transparent PNG production poses in `design/mascot/final/`, preview in `design/mascot/final/preview.html`. The mascot is the only colored element in the UI |
| 2026-10-23 | Mascot appears only in emotional moments (welcome, empty states, sign-up success, "¡Ya se armó!", cancellation) | Never on payments, forms or admin panels |
| 2026-10-23 | Mascot and logo are produced with Codex; Claude provides the prompts | |

### Open items
- Mascot delivered as separate transparent PNGs in 1024/512/256 px; optional future vector reconstruction
- Session 5: screens per role, starting with the player

## Session 5 — Player screens (2026-10-25)

| Date | Decision | Notes |
|---|---|---|
| 2026-10-25 | Eight player screens: welcome/sign-up & sign-in, Explore, Match detail, Payment sheet, Success, My matches, Balance, Profile | |
| 2026-10-25 | Explore sorted by nearest date; filters All · Today · Tomorrow · This weekend · Free | Full matches shown as "Llena" (disabled); cancelled and played matches hidden |
| 2026-10-25 | Featured card "Se está armando": the pending match closest to its minimum | Falls back to the next upcoming match |
| 2026-10-25 | Match detail: cover photo, title, date/time, field + address with "Abrir en Maps" link, organizer, description, price, capacity bar with minimum marker, deadline explained in one line, sign-ups by first name ("Ana, Luis, Carlos y 5 más") | Maps link is a plain URL built from the address |
| 2026-10-25 | Payment as a bottom sheet over the detail: price, credit applied, total, "Pago de prueba · no se cobra dinero real" label, "Pagar $X (prueba)" or "Usar saldo" | Free matches skip the sheet: "Inscribirme" signs up directly |
| 2026-10-25 | Success screen with celebrating mascot: "¡Estás dentro!" or "¡Ya se armó la reta!" if this sign-up reached the minimum | Returns to the detail |
| 2026-10-25 | Detail when already signed up: "Estás inscrito" + "Darme de baja"; after the deadline: "Tu lugar está fijo" | |
| 2026-10-25 | My matches: tabs Upcoming (with drop-out before deadline) and History (played, cancelled, dropped, with attendance) | |
| 2026-10-25 | Drop-out asks for explicit confirmation stating the credit; toast "Te diste de baja · +$80 de saldo" | |
| 2026-10-25 | Balance: large amount, one-line explanation, transaction history linked to each match | |
| 2026-10-25 | Empty states use the waiting mascot plus a message and an action | |
| 2026-10-25 | Profile: initials avatar, editable name and phone, sign out | Password recovery out of MVP scope |
| 2026-10-25 | Schedule: only player screens get a full visual proposal; organizer, field manager and admin screens are built directly in code with the existing components | Implementation starts 2026-10-26 in parallel with player design approval |
