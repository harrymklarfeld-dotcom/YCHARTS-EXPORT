#!/bin/bash
# Double-click to pull LIVE YCharts numbers through your Excel Add-in (no manual export).
# One-time setup: Microsoft Excel installed + YCharts add-in logged in + (this installs) xlwings.
cd "$(dirname "$0")"
clear
echo "======================================"
echo "   Refresh YCharts (via Excel Add-in)"
echo "======================================"
git pull --quiet 2>/dev/null
python3 -m pip install --quiet --user xlwings openpyxl 2>&1 | grep -vi "warning\|notice\|already satisfied" | tail -2
if [ ! -f data/ycharts_pull.xlsx ]; then
  echo "First run: building the YCharts formula workbook..."
  python3 -m ycharts_export.excel_bridge --watchlist sl_model --portfolio --build || {
    echo "Could not build the workbook. Send this to Claude."; read -n 1 -s -r -p "Press any key."; exit 1; }
fi
echo
echo "Refreshing live YCharts data through Excel (a window may flash; that's normal)..."
echo "If macOS asks to let Terminal control Excel, click OK."
if python3 -m ycharts_export.excel_bridge --refresh; then
  echo
  echo "Done — live YCharts numbers are in. Opening the dashboard (Research tab)."
  python3 -m dashboard.serve --refresh 300 --open
else
  echo
  echo "The Excel refresh hit a snag. Copy the text above and send it to Claude."
  echo "Common causes: Excel not installed, the YCharts add-in isn't logged in, or macOS blocked automation."
  read -n 1 -s -r -p "Press any key to close."
fi
