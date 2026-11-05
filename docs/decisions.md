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

## Session 6 — Player screens review (2026-11-02)

Canvas: Claude Design "Retta · Identidad base", page Jugador. Boards marked "final" are the approved versions; variant boards stay for reference.

| Date | Decision | Notes |
|---|---|---|
| 2026-11-02 | Welcome screen: cover photo with a live match card ("Faltan 2 para que se arme"), "Continuar con Google" and "Registrarme con correo" | The card shows the pending match closest to its minimum. Carousel onboarding discarded |
| 2026-11-02 | Sign-in methods for the demo: Google and email/password | Apple deferred (needs an Apple Developer account) |
| 2026-11-02 | After Google sign-in, a "Completa tu perfil" step asks for the phone before entering | **Changes session 3**: a profile can exist without a phone until this step is done |
| 2026-11-02 | Phone field has a country selector (default MX +52, detected from the browser); numbers stored in international format | **Changes session 3** (10-digit Mexican only). Validate per country (e.g. libphonenumber); also feeds the WhatsApp link |
| 2026-11-02 | Sign-in screen: Google button, then email and password with "Mostrar"; no mascot | Mascot stays out of forms (session 4) |
| 2026-11-02 | Form errors: inline under each field, color `#FF8A7A` plus icon and text | First status color outside the neutral palette |
| 2026-11-02 | Passwords need at least 8 characters | Supabase default is 6 |
| 2026-11-02 | Match detail location: field name and area, plus a round map button that opens Maps | Full address removed from the screen. Area comes from the field (new short field or derived from the address) |
| 2026-11-02 | Match detail info as icon chips: format, level, type, changing rooms, plus one short organizer note | **Changes session 2** (no format field): adds `format`, `level` and `type` to matches; changing rooms belong to the field |
| 2026-11-02 | Level shown as 1–3 bars: green Principiante, yellow Intermedio, red Avanzado | Bar count also encodes the level, so it does not rely on color. Exception to "mascot is the only colored element" (session 4) |
| 2026-11-02 | Match type: Varonil (blue), Femenil (pink), Mixto (both) | Always shown with its label |
| 2026-11-02 | Toast: single line, close button, thin progress line that empties before it disappears | |
| 2026-11-03 | Google sign-in and sign-up out of the initial scope: email/password only. Welcome CTA is "Crear cuenta"; sign-in screen drops the Google button | **Changes the 2026-11-02 sign-in decisions.** "Completa tu perfil" stays as a fallback for accounts without a phone |
| 2026-11-03 | Explore: the featured card shows only under "Todas" and is left out of the list below it; filters live in the URL (`?f=hoy`) | Balance pill sits on the greeting row so the title fits on one line at 375 px |

### Open items
- Toast duration (proposed 5 s, paused while touched)
- Whether "Avanzado" red is too close to the error color (alternative: orange)
- Migrations for the model changes above: nullable phone until profile completion, international phone format, `format`/`level`/`type` on matches, area and changing rooms on fields
- Link the final Figma screens (page 03 · Jugador) to the 01 · Fundamentos components; they were imported as plain layers

## Session 7 — Visual refresh (2026-11-03)

Canvas: Claude Design "Retta · Jugador · Diseño final", page Direcciones visuales, row "Propuesta final". Goal: stop looking like a generic AI-built app (Codex greys, Geist, a pill on everything).

| Date | Decision | Notes |
|---|---|---|
| 2026-11-03 | Typography: Alegreya Sans for everything; titles and numbers at weight 500, body bold at 600 | **Changes session 4** (Big Shoulders + Geist). Chosen over 11 other pairings for a lighter, less geometric feel |
| 2026-11-03 | Palette "negro y azul silbato". Dark: bg `#0B0C0E`, surface `#141518`, elevated `#1B1D21`, border `#24262B`, text `#EDEEF0`, secondary `#8F9298`, accent `#3D6BFF` | **Changes session 4** (Codex-like neutrals, no brand color). The accent is the mascot's blue |
| 2026-11-03 | Light: bg `#F7F7F8`, surface `#FFFFFF`, elevated `#EEEFF2`, border `#E2E3E7`, text `#0E0F12`, secondary `#5E626A`, accent `#2F5BFF` | Darker blue so white button text keeps contrast |
| 2026-11-03 | Primary actions, active nav section, active filter and capacity fill use the accent with white text | **Changes session 4** (inverted text color) |
| 2026-11-03 | Bottom nav: 312 × 48 px; hides while scrolling down and comes back on scroll up | |
| 2026-11-03 | Pills (filters, status, info chips) one step smaller | |
| 2026-11-03 | Match capacity: one dot per place; taken dots filled, the ones still missing for the minimum outlined in the accent, plus "Faltan 2 para que se arme · cierra 17:00" | Replaces the bar with a minimum marker in the match detail |
| 2026-11-03 | No pull-down bounce at the top of the page | |
| 2026-11-03 | The map button opens an in-app sheet: Mapbox map with the field pin, the player's location and the driving route; driving and walking times; a secondary "Abrir en otra app para navegar" link | **Changes session 6** (round button that opened Maps). Times come from the Mapbox Directions API |
| 2026-11-03 | Location is asked only after an in-app explanation ("Usar mi ubicación" / "Ahora no"); it stays in the browser and is never stored | Without permission the map shows only the field |
| 2026-11-03 | Explore gets a "Cerca de mí" filter: sorts by driving time from the player and shows "6 min · 1.8 km" on each match | Explore's default order stays by date (session 5). Times come from the Mapbox Matrix API |
| 2026-11-03 | Fields store latitude and longitude | Needed for the map and distances; the admin sets them with the field |
| 2026-11-03 | Toasts stack open, newest at the bottom, up to 3 at once; each keeps its own close button and progress line | Light toast with a blue check and a shadow so it stands out from blue buttons behind it. Closes the toast duration item only partly (duration still open) |
| 2026-11-03 | Balance screen: amount in a compact card and the history as a vertical timeline (blue dots for credits, grey for uses and test payments), each entry naming what happened and the match | Variant C of three |
| 2026-11-03 | Profile screen: player card (initials, name, "Jugador desde…", matches played, attendance, balance), then a settings list (name, phone, email) where each row opens its own edit, then "Cerrar sesión" | Variant A of three |
| 2026-11-03 | Players can link Instagram and Facebook from their profile; other players see them only if they shared at least one match, from a player card opened in the sign-up list or history | New scope. Links open the social app; Retta stores only the usernames |
| 2026-11-03 | Motion: switching tabs slides the page in from the side of the previous tab (nav order); sheets rise from the bottom over a fading backdrop; toasts rise in; buttons and links shrink slightly when pressed. All quick (200–300 ms), no bounce, off with reduced motion | The bottom nav stays fixed while pages change |
| 2026-11-03 | Every tab and the match detail show a loading skeleton right away while their data loads | |
| 2026-11-03 | Organizer tools live under Perfil → Herramientas → "Tus retas" (Próximas / Pasadas); cards lead with the status ("Faltan 2 para que se arme") | Card variant 4 of five |
| 2026-11-03 | Create match: pick field, day and a free slot, then one question per screen (players, price with a keypad, format/level/type) and a review with "Editar" per row; title and note are optional at the end | Variant A of three. Closing options: 3, 2 or 1 h before start, only those the database accepts |
| 2026-11-03 | Manage match: capacity, sign-ups with a WhatsApp icon per player and "Recordar a todos" (opens WhatsApp with the message ready to send to the match group); cancel needs a reason | A web app cannot message several WhatsApp contacts at once without the paid Business API |
| 2026-11-03 | Field managers reach "Tus canchas" from Perfil → Herramientas; each field has a 14-day agenda with free slots (removable) and booked ones (match, organizer, sign-ups) | |
| 2026-11-03 | Slots are published in bulk: weekdays × start hours, duration 1 h / 1 h 30 / 2 h, for 1, 2 or 4 weeks; past times and overlaps are skipped | |
| 2026-11-04 | Agentic component (hackathon requirement): one agent, "Agente Retta", that makes matches happen. **Rescue:** before the confirmation deadline of a match short of its minimum, it invites similar players, can extend the deadline within the rules, and proposes moving the match (the organizer approves). **Reactivation:** weekly, it recommends a concrete nearby match to players who stopped playing | **New scope.** Team balancing by level stays out (no player level). Answers the professor's feedback of 2026-11-02 |
| 2026-11-04 | The agent runs on a free LLM tier (Gemini first; provider-agnostic through the OpenAI-compatible API) with a rule-based fallback, so the demo works without the model | No paid API |
| 2026-11-04 | ODS 3 impact metric: minutes of physical activity = confirmed attendance × match duration, plus matches rescued and players reactivated | Shown to the admin |
| 2026-11-04 | From now on, no grill-me sessions: Claude proposes designs in Claude Design, the user asks for variants or approves, then it is built in code | Changes the working flow in CLAUDE.md |
| 2026-11-04 | Admin home is "Tarjetas con foto" (Canchas and Retas as large photo cards, Usuarios with stacked initials). Admins get their own bottom nav: Inicio · Canchas · Usuarios · Retas · Perfil; their own matches and balance open from Perfil | Option N1 of three |
| 2026-11-04 | Explore gets a bell with an unread count; opening Avisos plays a circular reveal from the bell (bell rings and presses, the page behind recedes and blurs, items rise in a cascade), under 0.5 s, off with reduced motion | New scope: in-app notices inbox (no email or push) |
| 2026-11-04 | Avisos: agent invitations come first as a swipeable deck of photo cards ("1 de 3", closing countdown, "Unirme" / dismiss); notices that need no answer follow as one-line rows | Invitation variant D. Notices stay short and actionable; the agent's reasoning lives in the match detail |
| 2026-11-04 | Organizer sees the agent as a task list: "Agente trabajando" with each step's state (done, in progress, queued) and its result, plus "Detener agente"; no technical or tool-call details | Variant B of four |
| 2026-11-04 | Moving a match is a proposal sheet for the organizer: current vs proposed slot, why, what happens to sign-ups, "Mover a las 20:00" / "Dejarla como está" | Nothing moves without the organizer's approval |
| 2026-11-04 | Admin agent impact screen: the celebrating mascot says how many matches it saved this week, one big number of minutes played, and two tappable lines (players back, matches not saved) | Variant A. **Changes 2026-10-23:** the mascot may appear in the admin panel for agent achievements |
| 2026-11-04 | Admin screens follow flow B, short steps and sheets: Canchas is a plain list with a round + ("Asignar" when a field has no manager); new field in 3 one-question steps (name + "Tomar foto", full-screen map whose pin fills the address, manager + changing rooms); Usuarios is search + list, tapping a person opens a sheet where tapping a role saves it; Retas grouped by day with a dot for pending ones, tapping one opens a sheet with only "Cancelar reta" and an optional "Agregar motivo" | Flow B of three. Field photos taken with the camera need Supabase Storage: **changes session 4** (no uploads) |
| 2026-11-04 | Reactivation in Explore is a message from the agent in a chat bubble ("Hace 3 semanas que no juegas. El jueves a las 20:00 hay reta…") with quick replies "Me apunto" / "Otro día" / "Más opciones" | Card variant E |
| 2026-11-04 | Agent runtime: pg_cron calls `/api/agente/tick` every 5 minutes (URL and secret in Supabase Vault). A pending match gets a first pass when its deadline is under 1 h away (invite up to 10 similar players, extend the deadline to 1 h before start) and a second pass 30 min later (invite more or propose a slot); reactivation runs weekly. Each pass is planned by the LLM with tools when `AGENT_LLM_API_KEY` is set, otherwise by rules | The database enforces every rule (deadline limits, free slot, organizer approval), so the model cannot break them |
| 2026-11-04 | Waiting feedback: (A) buttons for money or irreversible actions shrink on tap, show a spinner with the action ("Inscribiendo…") and end in a confirmation; (B) changing screens shows a thin progress bar on top and shimmering skeletons; (C) small, rarely failing actions (role, attendance, stopping the agent, dismissing a notice) change the screen at once with a "Guardando… / Guardado" chip and roll back with a toast on error | All three approved together; the app should never look stuck |
| 2026-11-04 | Admins can take a field photo or pick one from the gallery (one file input), or choose a bundled cover; photos are resized to 1600 px on the device and stored in the public `field-photos` bucket | **Changes session 4** (no uploads); `fields.cover_image` holds a bundled key or the photo URL |
| 2026-11-04 | Desktop (≥1024 px) follows a chat-app layout (option E): a left sidebar with the wordmark, "Buscar retas ⌘K", Explorar · Mis retas · Avisos (with count) · Saldo, a "Tus próximas" list and the profile at the bottom; no bell in the top bar. Explorar starts with "¿Dónde juegas hoy?" and a large search box with filter chips plus three agent suggestions; searching moves the box to the top of the column and lists results below; a match opens in a right-side panel over the list (closes with ✕ or Esc) | Phone layout stays as is |
| 2026-11-05 | Desktop welcome (option A): the photo with the live featured match and the headline fill the left; the right column says "Juega esta semana" with Crear cuenta and Iniciar sesión. Sign-in and sign-up keep the photo on the left and put their form on the right | Phones unchanged |
| 2026-11-05 | Visual style "Plano 2": Inter (800 for titles, tight tracking), nearly square corners (4–6 px; circles only for avatars and dots), pure black background with #0e0e0e surfaces and #262626 lines. Phone layouts stay as they were; only type, corners and tones change | **Changes session 7** (Alegreya Sans, rounded pills) |
| 2026-11-05 | Desktop Explorar is a conversation with the agent (chat A; start B1 + B2): the agent greets with what is on today and quick replies, then the box, then "Hoy se juegan". Each message shows a breathing avatar and a shimmering line, then the understood filters with ✓, a short reply and matches with "Unirme" (opens the side panel). Gemini reads the message when available; rules otherwise. With no results it drops one filter at a time (price first, day last) and says so. Matches the person already joined are not suggested | |
| 2026-11-05 | Desktop match page (detail A): two columns, photo and details on the left, a sticky card on the right with price, capacity and the action; a ✕ top left goes back (Esc too). Desktop Mis retas (option A): one row per match like a trip history (day and time, photo, name, field and note, state, Ver and Darme de baja) under underlined tabs | Phones unchanged |

### Open items
- Apply the new style to the remaining canvas screens (sign-up, sign-in, payment, success, my matches, drop-out, balance, profile, empty state)
- Replace stadium photos with amateur field photos
