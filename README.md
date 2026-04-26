# Epic Lotto

A lottery, syndicate, and wallet platform built on **Vite + React +
TypeScript + Tailwind/shadcn-ui** with **Supabase** providing auth,
Postgres, and edge functions.

## Quick start

```bash
cp .env.example .env.local
# fill in VITE_SUPABASE_* values from your Supabase dashboard
npm install
npm run dev          # http://localhost:8080
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run build:dev` | Development-mode build (keeps source maps & lovable-tagger) |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | ESLint over the project |
| `npm run test` | Run Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |

## Deployment

Production runs on **Vercel** (frontend) + **Supabase** (database, auth,
edge functions). The full step-by-step is in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

Short version:

1. Configure Supabase: `supabase link --project-ref <REF>`, then
   `./scripts/deploy-supabase.sh` to push migrations and deploy every
   edge function. Upload provider secrets with
   `./scripts/set-supabase-secrets.sh`.
2. Import the repo in Vercel (framework auto-detected as Vite via
   `vercel.json`). Add the three `VITE_SUPABASE_*` env vars to
   Production / Preview / Development.
3. Push to the default branch — Vercel deploys automatically.

## Project layout

```
src/                 React app (pages, components, hooks, contexts)
src/integrations/    Supabase client + generated types
supabase/migrations/ Versioned SQL migrations (applied via `supabase db push`)
supabase/functions/  Deno edge functions (each exposes GET /health)
scripts/             Deployment & verification helpers
public/              Static assets served as-is by Vercel
```

## Edge function health

Every edge function exposes a public liveness probe at
`GET /functions/v1/<function-name>/health` returning `{"status":"ok"}`.
Details and the full function inventory are in
[`supabase/functions/HEALTH_ENDPOINTS.md`](./supabase/functions/HEALTH_ENDPOINTS.md).
