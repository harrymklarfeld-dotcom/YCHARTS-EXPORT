@echo off
cd /d "%~dp0"
cls
echo ======================================
echo    Portfolio Desk
echo ======================================
where python >nul 2>nul
if errorlevel 1 (
  echo Python is not installed. The Microsoft Store will open; click Get on "Python 3.12", then double-click this again.
  start ms-windows-store://pdp/?productid=9NCVDN91XZQP
  pause
  exit /b 1
)
echo Checking for updates...
git pull --quiet 2>nul
python -m pip install --quiet -r requirements.txt
echo.
echo Pulling your Robinhood account...
python -m portfolio.robinhood_sync
if errorlevel 1 (
  echo.
  echo The Robinhood pull failed. Take a photo of this window and send it to Claude, or drop an Activity CSV in data\portfolio\imports and run this again.
  echo Opening the dashboard with the last saved data...
  python -m dashboard.serve --refresh 300 --open
  pause
  exit /b 0
)
echo.
echo Writing your portfolio analysis...
python -m portfolio.analyze >nul 2>nul
echo.
echo Opening your dashboard. Keep this window open; close it to stop.
python -m dashboard.serve --refresh 300 --open
pause
