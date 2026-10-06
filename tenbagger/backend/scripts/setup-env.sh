#!/usr/bin/env bash
# Creates supabase/functions/.env (git-ignored) for a real Plaid deployment.
# Usage: bash scripts/setup-env.sh <supabase-project-ref>
# Asks for the Plaid client_id and secret (secret input is hidden), generates the token-encryption key,
# and never prints secrets. Re-run it to switch from the Sandbox secret to the Production (Trial) one.
set -euo pipefail
cd "$(dirname "$0")/.."
REF="${1:?usage: bash scripts/setup-env.sh <supabase-project-ref>}"
OUT=supabase/functions/.env

read -r -p "Plaid environment (sandbox/production) [sandbox]: " PLAID_ENV
PLAID_ENV="${PLAID_ENV:-sandbox}"
read -r -p "Plaid client_id: " PLAID_CLIENT_ID
read -r -s -p "Plaid ${PLAID_ENV} secret (hidden while typing): " PLAID_SECRET; echo

KEYS_LINE=""
if [ -f "$OUT" ] && grep -q '^TOKEN_ENCRYPTION_KEYS=' "$OUT"; then
  # Keep the existing key: changing it would make stored bank tokens unreadable.
  KEYS_LINE="$(grep '^TOKEN_ENCRYPTION_KEYS=' "$OUT")"
else
  KEYS_LINE="TOKEN_ENCRYPTION_KEYS={\"k2026a\":\"$(openssl rand -base64 32)\"}"
fi

umask 077
cat > "$OUT" <<ENV
${KEYS_LINE}
TOKEN_ENCRYPTION_ACTIVE_KEY_ID=k2026a
PROVIDER_MODE=plaid
PLAID_CLIENT_ID=${PLAID_CLIENT_ID}
PLAID_SECRET=${PLAID_SECRET}
PLAID_ENV=${PLAID_ENV}
PLAID_WEBHOOK_URL=https://${REF}.supabase.co/functions/v1/plaid-webhook
PLAID_REALTIME_BALANCES=false
PLAID_TRANSACTIONS_DAYS_REQUESTED=180
REQUIRE_MFA_FOR_LINKING=true
ALLOWED_ORIGINS=http://localhost:8081
MIN_SYNC_INTERVAL_SEC=60
ENV
chmod 600 "$OUT"
git check-ignore -q "$OUT" && echo "Wrote $OUT (private, git-ignored). Plaid env: ${PLAID_ENV}." \
  || { echo "WARNING: $OUT is not git-ignored. Do not commit it."; exit 1; }
