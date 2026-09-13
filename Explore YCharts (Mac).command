#!/bin/bash
# Double-click to let Claude "look around" YCharts, read-only, in your own logged-in browser.
# It opens a browser, waits for you to log in, then tours the Tools/Data menus and screenshots
# them. It NEVER saves or builds anything in YCharts (it blocks writes at the browser level).
# When it finishes, send research/ycharts_capture/catalog.md back to Claude.
cd "$(dirname "$0")"
clear
echo "==================================================="
echo "   Explore YCharts (read-only) for Claude"
echo "==================================================="
git pull --quiet 2>/dev/null
echo "Making sure the browser tooling is installed (first run only)..."
python3 -m pip install --quiet --user playwright 2>&1 | grep -vi "warning\|notice\|already satisfied" | tail -1
python3 -m playwright install chromium 2>&1 | tail -1
echo
echo "Opening a browser. Log in to YCharts, then come back here and press Enter."
python3 tools/ycharts_explore.py || {
  echo; echo "Something went wrong. Copy the text above and send it to Claude."
  read -n 1 -s -r -p "Press any key to close."; exit 1; }
echo
echo "Captured. Now send  research/ycharts_capture/catalog.md  back to Claude."
echo "(Screenshots are in research/ycharts_capture/shots/ if Claude asks for any.)"
read -n 1 -s -r -p "Press any key to close."
