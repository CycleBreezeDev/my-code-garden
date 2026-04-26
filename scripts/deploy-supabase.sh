#!/usr/bin/env bash
# Deploy database migrations and all edge functions to the linked
# Supabase project. Run from the repo root.
#
# Prereqs:
#   - Supabase CLI installed (https://supabase.com/docs/guides/cli)
#   - `supabase login` completed
#   - `supabase link --project-ref <PROJECT_REF>` completed
#   - Edge function secrets uploaded (see scripts/set-supabase-secrets.sh)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: supabase CLI not found. Install: https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

echo "==> Pushing database migrations"
supabase db push

echo "==> Deploying edge functions"
for fn_dir in supabase/functions/*/; do
  fn_name="$(basename "$fn_dir")"
  # Skip shared utilities directory
  if [[ "$fn_name" == "_shared" ]]; then continue; fi
  echo "  - $fn_name"
  supabase functions deploy "$fn_name" --no-verify-jwt
done

echo "==> Done. Verify health probes:"
echo "    curl -i \"https://\${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/fx-quote/health\""
