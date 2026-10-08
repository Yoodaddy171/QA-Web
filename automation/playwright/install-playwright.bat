@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo QA Web - Playwright Automation Installer
echo ==========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js tidak ditemukan di PATH.
  exit /b 1
)

echo [1/2] Installing npm dependencies...
call npm install
if errorlevel 1 exit /b 1

echo.
echo [2/2] Installing Chromium...
call npx playwright install chromium
if errorlevel 1 exit /b 1

echo.
echo Installation complete.
pause
