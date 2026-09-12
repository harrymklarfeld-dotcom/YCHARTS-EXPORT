#!/bin/bash
# Double-click this. It updates itself, pulls your Robinhood account, writes an analysis, and opens the dashboard.
cd "$(dirname "$0")"
clear
echo "======================================"
echo "   Portfolio Desk"
echo "======================================"
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python is not installed. macOS will offer the developer tools now; click Install, wait, then double-click this again."
  xcode-select --install 2>/dev/null
  read -n 1 -s -r -p "Press any key to close."; exit 1
fi
echo "Checking for updates..."
git pull --quiet 2>/dev/null || echo "(could not check for updates; continuing)"
python3 -m pip install --quiet --user -r requirements.txt 2>&1 | grep -v -i "warning\|notice\|already satisfied" | tail -3
echo
echo "Pulling your Robinhood account (this can take a minute the first time each day)..."
if python3 -m portfolio.robinhood_sync; then
  echo
  echo "Writing your portfolio analysis to the reports folder..."
  python3 -m portfolio.analyze >/dev/null 2>&1 && echo "  done: reports/portfolio_analysis_$(date +%Y-%m-%d).md"
  echo
  echo "Opening your dashboard. Keep this window open; close it to stop."
  python3 -m dashboard.serve --refresh 300 --open
else
  echo
  echo "The Robinhood pull failed. Two options:"
  echo "  1) Take a photo of this window and send it to Claude."
  echo "  2) Download an Activity CSV from Robinhood and drop it in data/portfolio/imports, then run this again."
  echo
  echo "Opening the dashboard with whatever data was last saved..."
  python3 -m dashboard.serve --refresh 300 --open
fi
