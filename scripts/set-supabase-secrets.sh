#!/usr/bin/env bash
# Push edge-function secrets from a local file to the linked Supabase
# project. Reads KEY=VALUE pairs from a file (default: ./.env.supabase).
#
# Usage:
#   ./scripts/set-supabase-secrets.sh             # uses ./.env.supabase
#   ./scripts/set-supabase-secrets.sh path/to/env # custom file
#
# IMPORTANT: never commit the source file. .env.supabase is gitignored.

set -euo pipefail

ENV_FILE="${1:-.env.supabase}"

if [[ ! -f "$ENV_FILE" ]]; then
  cat >&2 <<EOF
ERROR: $ENV_FILE not found.

Create it from .env.example, keeping ONLY the edge-function secrets
(do NOT prefix with VITE_). Example:

  PAYSTACK_SECRET_KEY=sk_live_xxx
  FLUTTERWAVE_SECRET_KEY=FLWSECK-xxx
  FLUTTERWAVE_WEBHOOK_HASH=xxx
  LOVABLE_API_KEY=xxx
  LOVABLE_SEND_URL=https://...
  GITHUB_PAT=ghp_xxx
  GITHUB_REPO=owner/repo
  FIRECRAWL_API_KEY=xxx
EOF
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: supabase CLI not found." >&2
  exit 1
fi

echo "==> Uploading secrets from $ENV_FILE"
supabase secrets set --env-file "$ENV_FILE"
echo "==> Done. List with: supabase secrets list"
