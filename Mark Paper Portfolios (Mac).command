#!/bin/bash
# Double-click to record a snapshot of every paper-trading book. Schedule it (see below) to build history.
cd "$(dirname "$0")"
git pull --quiet 2>/dev/null
python3 -m portfolio.paper mark
echo
echo "Tip: to snapshot automatically every weekday at 4pm, run this once in Terminal:"
echo "  (crontab -l 2>/dev/null; echo '0 16 * * 1-5 cd \"$(pwd)\" && /usr/bin/python3 -m portfolio.paper mark') | crontab -"
read -n 1 -s -r -p "Press any key to close."
