@echo off
setlocal

cd /d "%~dp0"

echo Starting QADesk production services...
echo.
echo Web app      : http://localhost:3000
echo Relay server : http://127.0.0.1:3001
echo.

if not exist "node_modules" (
  echo node_modules not found.
  echo Please run npm install first, then run this file again.
  pause
  exit /b 1
)

if not exist ".next\standalone\server.js" (
  echo Production build not found.
  echo Please run npm run build first, then run this file again.
  pause
  exit /b 1
)

if not exist "mini-services\ws-server.js" (
  echo mini-services\ws-server.js not found.
  pause
  exit /b 1
)

start "QADesk Relay - 3001" cmd /k "cd /d ""%~dp0"" && node mini-services\ws-server.js"
start "QADesk Web Production - 3000" cmd /k "cd /d ""%~dp0"" && set NODE_ENV=production && npm start"

echo Production services are starting in separate windows.
echo Keep both windows open while using automation/manual capture.
echo.
timeout /t 3 /nobreak >nul
start http://localhost:3000

endlocal
