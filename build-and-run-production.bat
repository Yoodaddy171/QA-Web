@echo off
setlocal

cd /d "%~dp0"

echo ======================================================================
echo   Traceva / QADesk Rebuild and Production Launcher
echo ======================================================================
echo.

echo [1/3] Memeriksa proses yang sedang berjalan pada port 3000 dan 3001...
if exist "scripts\stop-services-on-ports.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-services-on-ports.ps1" 3000 3001
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "3000, 3001 | ForEach-Object { $c = Get-NetTCPConnection -LocalPort $_ -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 4 }; if ($c) { $c | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } } }"
)

echo.
echo [2/3] Memulai proses kompilasi production (npm run build)...
echo.

call npm run build
if errorlevel 1 (
  echo.
  echo ======================================================================
  echo   [ERROR] Kompilasi 'npm run build' gagal!
  echo   Layanan produksi tidak dijalankan. Silakan cek pesan error di atas.
  echo ======================================================================
  echo.
  pause
  exit /b 1
)

echo.
echo ======================================================================
echo   [OK] Production build berhasil dibuat!
echo ======================================================================
echo.
echo [3/3] Menjalankan layanan produksi via run-web-qa-production.bat...
echo.

if not exist "run-web-qa-production.bat" (
  echo [ERROR] File run-web-qa-production.bat tidak ditemukan.
  pause
  exit /b 1
)

call run-web-qa-production.bat

endlocal
