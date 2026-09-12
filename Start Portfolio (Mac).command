#!/bin/bash
# Double-click this file. It installs what it needs, logs in to Robinhood, and opens the dashboard.
cd "$(dirname "$0")"
echo "== Portfolio Desk =="
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python is not installed. macOS will now offer to install the developer tools; click Install, wait, then double-click this file again."
  xcode-select --install 2>/dev/null
  read -n 1 -s -r -p "Press any key to close."; exit 1
fi
python3 -m pip install --quiet --user -r requirements.txt 2>&1 | grep -v -i "warning\|notice" 
if [ ! -f data/portfolio/snapshot.json ]; then
  echo
  echo "First time: logging in to Robinhood. Have the Robinhood app open on your phone."
  echo "Type your Robinhood email, press Enter, type your password (it stays invisible), press Enter,"
  echo "then tap Approve on your phone."
  echo
  python3 -m portfolio.robinhood_sync || { echo; echo "Login did not work. Take a photo or copy the text above and send it to Claude."; read -n 1 -s -r -p "Press any key to close."; exit 1; }
fi
echo
echo "Opening your dashboard at http://127.0.0.1:8765  (keep this window open; close it to stop)"
python3 -m dashboard.serve --refresh 300 --open
