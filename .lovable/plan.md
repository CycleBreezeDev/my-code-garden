

## Reconfigure project after GitHub import

You added new files via GitHub. To make the app fully functional in Lovable, three things need to happen: apply the database schema, fix a few TypeScript errors in the edge functions, and deploy the edge functions. Secrets also need to be confirmed.

### 1. Apply database migrations

There are 27 SQL migration files in `supabase/migrations/` that have not been applied to your Lovable Cloud database. These create:

- Core app tables (lotteries, tickets, payouts, syndicates, KYC, wallet, transactions, FX pairs, withdrawal configs, social/feed/messaging, notifications, contact submissions, etc.)
- The email infrastructure: `email_send_log`, `email_send_state`, `suppressed_emails`, unsubscribe tables, PGMQ queues (`auth_emails`, `transactional_emails`, plus DLQs), and RPCs (`read_email_batch`, `delete_email`, `move_to_dlq`)
- Required extensions: `pg_net`, `pg_cron`, `supabase_vault`, `pgmq`
- RLS policies, the `user_roles` table + `has_role()` security-definer function, and a security-definer `is_admin()` helper
- Storage buckets for KYC, lottery branding, etc.

I'll run all migrations in order, then regenerate `src/integrations/supabase/types.ts` so the generated types include the new tables and RPCs.

### 2. Fix edge function TypeScript errors

After regenerating types, most errors in `process-email-queue/index.ts` will resolve automatically (they exist because the current `types.ts` has none of the new tables). Two small code-level fixes also needed:

- **`supabase/functions/bank-list/index.ts` (line 42)** — change `String(e?.message || e)` to a properly narrowed `error instanceof Error ? error.message : String(error)` pattern.
- **`supabase/functions/process-email-queue/index.ts`** — type the `moveToDlq` helper's `supabase` parameter as `SupabaseClient` (imported from `@supabase/supabase-js`) instead of `ReturnType<typeof createClient>`, and add explicit `any` types for the `messages.map((msg) => …)` and `.filter((id) => …)` callbacks.

I'll also re-check the other functions listed in the build output (`payout-webhook-flutterwave`, `payout-webhook-paystack`, `paystack-webhook`, `handle-email-suppression`, `handle-email-unsubscribe`) for the same patterns and fix any similar narrow issues.

### 3. Deploy edge functions

Once types and code compile, deploy all 21 edge functions so they're live on your Supabase project. `supabase/config.toml` already declares the correct `verify_jwt` settings per function, so no config changes needed.

### 4. Confirm required secrets

The following secrets must exist in Lovable Cloud → Secrets for the functions to work at runtime. I'll list what's set and flag anything missing — you'll need to add the missing ones manually:

- `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`
- `FLUTTERWAVE_SECRET_KEY`
- `LOVABLE_API_KEY` (for email sending + suppression webhook HMAC)
- Any provider webhook secrets used by `paystack-webhook`, `payout-webhook-paystack`, `payout-webhook-flutterwave`

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` are auto-injected by Lovable Cloud — no action needed.

### What I will NOT change

- No new features, no UI changes, no business logic changes.
- I won't touch `supabase/config.toml` (already correct).
- I won't modify migration files (they're treated as immutable history once applied).

### Order of operations

```text
1. Apply migrations 1 → 27 (in filename order)
2. Regenerate src/integrations/supabase/types.ts
3. Patch bank-list/index.ts and process-email-queue/index.ts
4. Re-check + patch other listed edge functions
5. Deploy all edge functions
6. Report secret status
```

Approve this and I'll switch to default mode and execute it end-to-end.

