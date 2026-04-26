# Deployment Guide — Vercel + Supabase

End-to-end checklist for taking Epic Lotto from a fresh clone to a live
production deployment on **Vercel** (frontend) + **Supabase** (database,
auth, edge functions).

---

## 1. Prerequisites

- A Supabase account and a created project — note the **Project Ref**
  (the subdomain piece of `https://<ref>.supabase.co`).
- A Vercel account connected to your GitHub org.
- Node.js 20+ and npm 10+ locally (Vercel uses Node 20 by default).
- [Supabase CLI](https://supabase.com/docs/guides/cli) for migrations &
  edge functions.

---

## 2. Supabase setup

### 2a. Link the CLI to your project

```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
```

The repo's `supabase/config.toml` pins the project ref. If you are
deploying to a different Supabase project, update that file (or override
with `--project-ref` on every CLI call).

### 2b. Push database migrations

All schema, RLS policies, triggers, and seed helpers live under
`supabase/migrations/`. Apply them with:

```bash
supabase db push
```

…or use the helper script (which also redeploys edge functions):

```bash
./scripts/deploy-supabase.sh
```

If this is a brand-new project, the CLI will play every migration in
order. To verify after the run, open the SQL editor in the Supabase
dashboard and execute `scripts/verify-migration.sql`.

### 2c. Upload edge function secrets

Edge functions read provider keys from Supabase secrets, **not** from
Vercel env vars. Create a local `.env.supabase` (gitignored) with the
non-`VITE_` block from `.env.example`, then:

```bash
./scripts/set-supabase-secrets.sh
# or, manually:
supabase secrets set --env-file .env.supabase
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
auto-injected by the runtime — do not set them by hand.

### 2d. Deploy edge functions

```bash
./scripts/deploy-supabase.sh
```

…or one at a time:

```bash
supabase functions deploy paystack-webhook --no-verify-jwt
```

`--no-verify-jwt` is required because every function exposes a public
`GET /health` probe; auth is enforced inside the handler. See
`supabase/functions/HEALTH_ENDPOINTS.md`.

### 2e. Configure Auth redirect URLs

In Supabase **Authentication → URL Configuration**, add:

- **Site URL:** `https://<your-vercel-domain>`
- **Redirect URLs:**
  - `https://<your-vercel-domain>/**`
  - `https://<your-vercel-preview-domain>/**` (wildcard for preview branches)
  - `http://localhost:8080/**` (local dev)

### 2f. Wire payment provider webhooks

Each provider must point at the matching Supabase edge function:

| Provider | Webhook URL |
|---|---|
| Paystack (charge) | `https://<ref>.supabase.co/functions/v1/paystack-webhook` |
| Paystack (transfer/payout) | `https://<ref>.supabase.co/functions/v1/payout-webhook-paystack` |
| Paystack (wallet top-up) | `https://<ref>.supabase.co/functions/v1/wallet-topup-webhook` |
| Flutterwave (payout) | `https://<ref>.supabase.co/functions/v1/payout-webhook-flutterwave` |
| Mailgun (suppressions) | `https://<ref>.supabase.co/functions/v1/handle-email-suppression` |

### 2g. Schedule cron jobs

In Supabase **Database → Cron**, schedule:

- `process-email-queue` — every minute
- `refresh-lottery-feeds` — every 5–15 minutes (per business need)

Both invocations use the service-role key.

---

## 3. Vercel setup

### 3a. Import the repository

1. Vercel Dashboard → **Add New… → Project** → select this repo.
2. Framework preset: **Vite** (auto-detected; `vercel.json` pins it).
3. Build command, install command, and output directory are picked up
   from `vercel.json` — no overrides needed.

### 3b. Environment variables

In **Project → Settings → Environment Variables**, add the `VITE_*`
keys from `.env.example` to **Production**, **Preview**, and
**Development**:

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_SUPABASE_PROJECT_ID` | `<ref>` |

Only `VITE_*` keys are bundled into the browser build. Do not put
service-role keys or provider secrets here — they belong in Supabase
secrets (§2c).

### 3c. Custom domain

**Project → Settings → Domains** → add your apex/subdomain. After DNS
propagates, copy the final URL back into Supabase Auth (§2e).

### 3d. Deploy

Push to your default branch — Vercel auto-deploys. Every PR gets a
preview URL.

---

## 4. Post-deploy verification

```bash
# 1. App loads
curl -I https://<your-vercel-domain>/

# 2. Edge function is live
curl -i https://<ref>.supabase.co/functions/v1/fx-quote/health
# expect: 200 {"status":"ok"}

# 3. Migrations applied
psql "$DATABASE_URL" -f scripts/verify-migration.sql
```

In-app smoke checks:

1. Sign up / log in (verifies auth + email).
2. Open `/lotteries` and `/results` (verifies public reads + RLS).
3. As an admin user, open `/admin/secrets` — every required secret should
   show ✅. Anything red maps directly back to §2c.
4. As an admin, open `/admin/github` — confirms `GITHUB_PAT` /
   `GITHUB_REPO` plumbing.

---

## 5. Local development

```bash
cp .env.example .env.local
# edit .env.local with your Supabase project values
npm install
npm run dev          # http://localhost:8080
```

To run edge functions locally:

```bash
supabase start
supabase functions serve --env-file .env.supabase
```

---

## 6. Troubleshooting

- **Blank page / 404s on refresh** — `vercel.json` rewrites all non-API
  paths to `/index.html`. If you see 404s, confirm the file shipped.
- **`supabase` is not defined / auth errors at runtime** — the `VITE_*`
  vars were missing at build time. Re-deploy *after* adding them; Vite
  inlines env vars at build, not at runtime.
- **Edge function 401** — make sure the call includes
  `Authorization: Bearer <user-jwt>` (or `apikey: <anon-key>` for public
  endpoints). The `/health` probe is the only fully unauthenticated path.
- **Migration push fails on `extension`/`schema` errors** — enable the
  required extensions in **Database → Extensions** (`pg_cron`, `pgmq`,
  `http`, `pg_net`) before retrying `supabase db push`.
