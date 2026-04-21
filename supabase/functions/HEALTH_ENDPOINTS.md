# Edge Function Health Endpoints

Every edge function in this project exposes a public liveness probe at
`GET /health`. The probe is intentionally minimal: it confirms the function
is deployed and the runtime can serve a request. It does **not** verify
secrets, database connectivity, or downstream provider availability.

## Endpoint

```
GET https://<PROJECT_REF>.supabase.co/functions/v1/<function-name>/health
```

## Response

```
HTTP/1.1 200 OK
Content-Type: application/json
Access-Control-Allow-Origin: *

{ "status": "ok" }
```

## Required headers

**None.** The probe is fully public:

- No `Authorization` header required
- No `apikey` header required
- No webhook signature required (e.g. `x-paystack-signature`)

This is by design so external uptime monitors (UptimeRobot, BetterStack,
Pingdom, etc.) can check liveness without managing tokens.

> Note: the Supabase Functions gateway itself does not require an `apikey`
> header for these functions because they deploy with `verify_jwt = false`.
> If you front the project with a different gateway that enforces auth,
> you will need to whitelist `/health` paths there.

## What `200` means

- The function is deployed.
- The Deno runtime cold-started (or was already warm) and executed the
  handler.
- Routing reached the early-return health branch *before* any
  signature/JWT/method gates.

## What `200` does NOT mean

- It does **not** confirm `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`,
  `FLUTTERWAVE_SECRET_KEY`, `LOVABLE_API_KEY`, `GITHUB_PAT`, etc. are set
  or valid. Use the **Secrets Audit** admin page for that.
- It does **not** confirm the database is reachable or that PGMQ queues
  exist. Use the relevant admin pages (Function Health, GitHub Sync,
  Email Queue Test) for end-to-end checks.
- It does **not** invoke any downstream API (Paystack, Flutterwave,
  GitHub, Mailgun, exchange-rate provider).

## Covered functions

All 22 edge functions:

| Function | Notes |
|---|---|
| `bank-list` | Public list, OK to probe |
| `fx-quote` | Public probe; real calls require POST body |
| `github-sync-status` | Real calls require admin JWT |
| `handle-email-suppression` | Real calls require Mailgun webhook signature |
| `handle-email-unsubscribe` | Real calls require unsubscribe token |
| `kyc-admin-action` | Real calls require admin JWT |
| `kyc-submit` | Real calls require user JWT |
| `payout-webhook-flutterwave` | Real calls require Flutterwave signature header |
| `payout-webhook-paystack` | Real calls require Paystack HMAC |
| `paystack-init` | Real calls require user JWT |
| `paystack-verify` | Real calls require user JWT |
| `paystack-webhook` | Real calls require Paystack HMAC (`x-paystack-signature`) |
| `preview-transactional-email` | Real calls require admin JWT |
| `process-email-queue` | Real calls require service-role key (cron-invoked) |
| `refresh-lottery-feeds` | Cron-invoked |
| `resolve-account` | Real calls require user JWT |
| `secrets-audit` | Real calls require admin JWT |
| `send-transactional-email` | Real calls require service-role key |
| `wallet-init-topup` | Real calls require user JWT |
| `wallet-topup-webhook` | Real calls require Paystack HMAC |
| `withdrawal-admin-action` | Real calls require admin JWT |
| `withdrawal-create` | Real calls require user JWT |

## Curl example

```bash
curl -i https://<PROJECT_REF>.supabase.co/functions/v1/fx-quote/health
# HTTP/1.1 200 OK
# {"status":"ok"}
```

## Implementation pattern

Every function begins its `Deno.serve` handler with this early return,
placed *before* any auth, method, or signature checks:

```ts
Deno.serve(async (req) => {
  // GET /health — public liveness probe (no auth, no side effects)
  if (req.method === "GET" && new URL(req.url).pathname.endsWith("/health")) {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  // ...rest of handler
});
```

The `endsWith("/health")` match is robust against the function-name
prefix that Supabase routing adds to the path
(`/functions/v1/fx-quote/health` arrives as `/fx-quote/health` to the
handler).
