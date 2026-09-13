#!/bin/bash
# Double-click to refresh all free data: prices (Yahoo), fundamentals (SEC EDGAR), macro (FRED),
# margin-of-safety. No YCharts key needed. Then opens the dashboard.
cd "$(dirname "$0")"
clear
echo "Updating free data (prices, SEC fundamentals, FRED macro)..."
git pull --quiet 2>/dev/null
python3 -m pip install --quiet --user yfinance 2>&1 | grep -vi "warning\|notice\|already" | tail -1
python3 -m portfolio.macro
echo
echo "Pulling SEC filings for your holdings + the S&L model..."
python3 -m portfolio.edgar --portfolio --watchlist sl_model
python3 -m portfolio.valuation_gauge --portfolio -o reports/valuation.md 2>/dev/null
echo
echo "Building the ETF quote pages for the S&L hedge sleeve (holdings, risk, overlap)..."
python3 -m portfolio.etf_profile --all
echo
echo "Running the hedge-strategy diagnostics (beta, correlation, stress tests)..."
python3 -m portfolio.hedge_strategy --diagnose --build
python3 -m portfolio.hedge_strategy --json reports/hedge_strategy.json 2>/dev/null
echo
echo "Opening the dashboard — see the ETF profile and Macro tabs."
python3 -m dashboard.serve --refresh 300 --open
