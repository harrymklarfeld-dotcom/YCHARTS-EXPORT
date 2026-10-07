#!/usr/bin/env bash
# Builds the Tenbagger website and puts it online (Vercel, free Hobby plan).
# Usage: bash tenbagger/mobile/scripts/deploy-web.sh <supabase-project-ref>
# First run: asks for your Supabase anon key (public by design) and opens a browser to log in to Vercel.
set -euo pipefail
cd "$(dirname "$0")/.."
REF="${1:?usage: bash tenbagger/mobile/scripts/deploy-web.sh <supabase-project-ref>}"
step() { printf '\n\033[1m[%s/4] %s\033[0m\n' "$1" "$2"; }

command -v node >/dev/null || { echo "Node is missing. Run: brew install node"; exit 1; }

step 1 "App settings (.env.local, git-ignored)"
if ! grep -q '^EXPO_PUBLIC_SUPABASE_ANON_KEY=.' .env.local 2>/dev/null; then
  read -r -p "Supabase anon key (Legacy anon key, starts with eyJ...): " ANON
  printf 'EXPO_PUBLIC_SUPABASE_URL=https://%s.supabase.co\nEXPO_PUBLIC_SUPABASE_ANON_KEY=%s\n' "$REF" "$ANON" > .env.local
fi
git check-ignore -q .env.local || { echo "WARNING: .env.local is not git-ignored"; exit 1; }

step 2 "Install packages (first time takes a few minutes)"
npm ci --no-audit --no-fund

step 3 "Build the website"
rm -rf dist
npx expo export --platform web --clear  # --clear: re-inline EXPO_PUBLIC_* values
SITE=.web-deploy/tenbagger
rm -rf "$SITE/_expo" "$SITE/assets" "$SITE"/*.html 2>/dev/null || true
mkdir -p "$SITE"
cp -R dist/. "$SITE/"
# Single-page app: every path serves index.html (real files are served first).
printf '{ "rewrites": [ { "source": "/(.*)", "destination": "/index.html" } ] }\n' > "$SITE/vercel.json"

step 4 "Put it online (Vercel asks you to log in the first time)"
( cd "$SITE" && npx --yes vercel@latest deploy --prod --yes )

# The backend checks which websites may call it. Auth is by bearer token (no cookies), so allowing any
# origin does not expose data; tighten to the real domain once there is one.
if command -v supabase >/dev/null; then
  supabase secrets set ALLOWED_ORIGINS='*' --project-ref "$REF" >/dev/null && echo "Backend now accepts requests from the website."
fi
echo
echo "Done. Open the https://...vercel.app address printed above (the 'Production' or 'Aliased' line)."
