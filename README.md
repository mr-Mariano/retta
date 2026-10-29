# Retta

Course project for Diseño de Software (ITESO). A platform to find and join pickup football matches individually, with field time slots managed by field managers.

## Structure

- `app/` — Next.js (TypeScript) web app, deployed on Vercel, backed by Supabase.
- `design/` — approved brand assets: logo, mascot poses and cover photos.
- `docs/decisions.md` — decision log from the design sessions. Defines what the MVP actually builds.
- `docs/vision/` — product vision document (Spanish). Reference for the full scope.
- `docs/investigacion/` — background research. Context only; not approved scope.

## MVP scope

One-week controlled demo with seeded data. Mobile-first, dark mode first. Simulated payments (no real money), reusable credit, automatic confirmation/cancellation at the confirmation deadline, attendance tracking. See `docs/decisions.md` for the full list and what is out of scope.

## Running locally

```bash
cd app
cp .env.example .env.local   # fill in Supabase URL and anon key
npm install
npm run dev
```

## Deployment

Vercel project imported from this repository with **Root Directory `app`** and the **Next.js** framework preset. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
