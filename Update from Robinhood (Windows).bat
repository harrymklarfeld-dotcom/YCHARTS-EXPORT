@echo off
cd /d "%~dp0"
python -m portfolio.robinhood_sync
pause
