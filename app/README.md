# Retta web app

Next.js 15 (App Router, TypeScript, Tailwind CSS 4) with Supabase. See the repository README for setup and deployment, and `AGENTS.md` for a map of features to files.

- Design tokens live in `src/app/globals.css` (dark mode; Inter for all text).
- Supabase clients: `src/lib/supabase/client.ts` (browser) and `src/lib/supabase/server.ts` (server).
- Agente Retta: `src/lib/agent/` (search, rescue, reactivation, LLM client) and `src/app/api/agente/tick/route.ts`.
