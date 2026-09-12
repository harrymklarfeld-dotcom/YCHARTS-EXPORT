@echo off
REM Double-click this file. It installs what it needs, logs in to Robinhood, and opens the dashboard.
cd /d "%~dp0"
echo == Portfolio Desk ==
where python >nul 2>nul
if errorlevel 1 (
  echo Python is not installed. The Microsoft Store will open; click Get on "Python 3.12", wait for it to finish, then double-click this file again.
  start ms-windows-store://pdp/?productid=9NCVDN91XZQP
  pause
  exit /b 1
)
python -m pip install --quiet -r requirements.txt
if not exist data\portfolio\snapshot.json (
  echo.
  echo First time: logging in to Robinhood. Have the Robinhood app open on your phone.
  echo Type your Robinhood email, press Enter, type your password ^(it stays invisible^), press Enter,
  echo then tap Approve on your phone.
  echo.
  python -m portfolio.robinhood_sync
  if errorlevel 1 (
    echo.
    echo Login did not work. Take a photo or copy the text above and send it to Claude.
    pause
    exit /b 1
  )
)
echo.
echo Opening your dashboard at http://127.0.0.1:8765  ^(keep this window open; close it to stop^)
python -m dashboard.serve --refresh 300 --open
pause
