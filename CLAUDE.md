# Retta

Course project for Diseño de Software (ITESO). A platform to find and join pickup football matches individually, with field time slots managed by field managers. The MVP is a one-week controlled demo with seeded data, mobile-first and dark mode first.

## Source of truth

- `docs/decisions.md` defines what the MVP builds. Check it before adding or changing scope; if something is not there, ask instead of assuming.
- `docs/vision/` is the full product vision (reference only). `docs/investigacion/` is background research, not approved scope.

## Stack

- **App:** Next.js 15 (App Router, TypeScript, Tailwind 4) in `app/`. Run all npm commands from `app/`.
- **Supabase:** clients in `app/src/lib/supabase/`. Schema changes go as SQL migrations in `supabase/migrations/` at the repo root; the Supabase GitHub integration applies them, so never change the schema by hand in the dashboard.
- **Vercel:** project `retta` in team `mr-marianos-projects`, Root Directory `app`, auto-deploy on push to `main`.
- **Env:** `app/.env.local` comes from `npx vercel env pull .env.local --environment=production` (the Supabase vars currently exist only in Production). Never commit it.

## Language

- Code, comments, commits and repo documentation: English.
- Product UI copy: Spanish.

## How I work

- Each topic goes through a grill-me session → proposal in Claude Design → my approval → Figma. Do not jump to Figma or code before I approve.
- Keep answers short and actionable.
- When I'm wrong or something is off, say so directly.
