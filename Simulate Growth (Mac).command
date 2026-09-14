#!/bin/bash
# Double-click to Monte-Carlo your CURRENT book forward one year, using your holdings' real
# historical behavior. Prints median / best / worst outcomes and the odds of a down year.
cd "$(dirname "$0")"
clear
echo "Simulating growth of your current holdings (this uses live prices via Yahoo)..."
git pull --quiet 2>/dev/null
python3 -m pip install --quiet --user yfinance 2>&1 | grep -vi "warning\|notice\|already" | tail -1
echo
echo "=== 1 year, holding as-is ==="
python3 -m portfolio.simulate --days 252 --paths 3000
echo
echo "=== 1 year, adding \$100/month ==="
python3 -m portfolio.simulate --days 252 --paths 3000 --deposit 100
echo
read -n 1 -s -r -p "Press any key to close."
