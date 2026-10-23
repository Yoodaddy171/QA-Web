@echo off
setlocal
title Traceva - Production + Relay + Runner + Quick Tunnel
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum ditemukan. Install Node.js 22 atau 24 LTS terlebih dahulu.
  pause
  exit /b 1
)
node scripts/start-prod-tunnel.mjs %*
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" pause
exit /b %RESULT%
