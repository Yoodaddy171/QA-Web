@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo QA Web - Playwright Automation
echo ==========================================
echo.
echo Pastikan QA Web relay sudah aktif:
echo   node mini-services\ws-server.js
echo.
echo DevLog relay:
echo   %QA_DEVLOG_URL%
echo.

if not exist "node_modules" (
  echo [ERROR] node_modules belum ada.
  echo Jalankan install-playwright.bat terlebih dahulu.
  exit /b 1
)

call npm test -- %*
