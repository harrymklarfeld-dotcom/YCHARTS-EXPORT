#!/bin/bash
# Double-click to pull your YCharts data into the local research cache.
cd "$(dirname "$0")"
clear
echo "======================================"
echo "   Pull YCharts data"
echo "======================================"
git pull --quiet 2>/dev/null
# load a saved key if present
[ -f .env ] && set -a && . ./.env 2>/dev/null && set +a
if [ -z "$YCHARTS_API_KEY" ]; then
  echo
  echo "Paste your YCharts API key and press Enter."
  echo "(YCharts > Account > 'Excel Add-in Access Key'. It is saved in .env, which git ignores,"
  echo " so you only enter it once. Keep it private.)"
  echo
  read -rs -p "API key: " KEY; echo
  if [ -z "$KEY" ]; then echo "No key entered. Exiting."; read -n 1 -s -r -p "Press any key."; exit 1; fi
  echo "YCHARTS_API_KEY=$KEY" >> .env
  export YCHARTS_API_KEY="$KEY"
fi
python3 -m pip install --quiet --user pycharts 2>&1 | grep -vi "warning\|notice\|already satisfied" | tail -2
echo
echo "Pulling the 10 S&L ETFs + your holdings from YCharts (a minute or two)..."
if python3 -m ycharts_export.api --watchlist sl_model --portfolio; then
  echo
  echo "Done. Opening the dashboard — click the RESEARCH tab to see it."
  python3 -m dashboard.serve --refresh 300 --open
else
  echo
  echo "The pull hit an error. Copy the red text above and send it to Claude."
  echo "(If it says the API key is invalid, your plan may be login-only; tell Claude and we use the Excel route.)"
  read -n 1 -s -r -p "Press any key to close."
fi
