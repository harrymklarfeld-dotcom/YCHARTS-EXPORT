#!/bin/bash
# Double-click to keep your holdings live. Logs into Robinhood once, then records your book
# (equity + each price) every 5 minutes while the market is open, into data/portfolio/intraday/.
# Leave this window open during the trading day. Read-only: it never trades.
cd "$(dirname "$0")"
clear
echo "==============================================="
echo "   Live portfolio recorder (read-only)"
echo "==============================================="
git pull --quiet 2>/dev/null
python3 -m pip install --quiet --user robin_stocks pyotp yfinance 2>&1 | grep -vi "warning\|notice\|already" | tail -1
echo "Logging into Robinhood (first run asks for your login + MFA; then it's cached)..."
python3 -m portfolio.autopull --loop --interval 300 || {
  echo; echo "Recorder stopped. If it was an error, copy the text above and send it to Claude."
  read -n 1 -s -r -p "Press any key to close."; }
