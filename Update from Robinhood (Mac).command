#!/bin/bash
# Double-click to pull fresh numbers from Robinhood (the dashboard's Refresh button does the same).
cd "$(dirname "$0")"
python3 -m portfolio.robinhood_sync
read -n 1 -s -r -p "Done. Press any key to close."
