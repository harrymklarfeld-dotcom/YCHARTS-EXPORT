#!/usr/bin/env bash
# One-shot backend setup for the founder trial run.
# Usage (from anywhere in the repo): bash tenbagger/backend/scripts/first-deploy.sh <supabase-project-ref>
# Asks only for: Plaid client_id, Plaid secret (hidden), and the Supabase database password.
set -euo pipefail
cd "$(dirname "$0")/.."
REF="${1:?usage: bash tenbagger/backend/scripts/first-deploy.sh <supabase-project-ref>}"
step() { printf '\n\033[1m[%s/5] %s\033[0m\n' "$1" "$2"; }

command -v supabase >/dev/null || { echo "Supabase CLI missing: brew install supabase/tap/supabase"; exit 1; }

step 1 "Private settings file (Plaid keys)"
bash scripts/setup-env.sh "$REF"

step 2 "Connect to your Supabase project (paste your DATABASE password when asked; it stays hidden)"
supabase link --project-ref "$REF"

step 3 "Create the database tables (type Y if asked)"
supabase db push

step 4 "Upload settings to Supabase"
supabase secrets set --env-file supabase/functions/.env

step 5 "Deploy the backend functions"
supabase functions deploy --project-ref "$REF" --use-api

printf '\nChecking it is live... '
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "https://${REF}.supabase.co/functions/v1/plaid-link-token" || true)
if [ "$code" = "401" ]; then
  echo "OK (the backend is up and correctly asks for sign-in)."
  echo "Done. Tell Claude: backend deployed."
else
  echo "got HTTP $code (expected 401). Copy everything above and send it to Claude."
fi
