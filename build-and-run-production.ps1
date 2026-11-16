# PowerShell script to stop running services on ports 3000/3001, rebuild, and run production
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  Traceva / QADesk Rebuild and Production Launcher" -ForegroundColor Cyan
Write-Host "======================================================================"
Write-Host ""

Write-Host "[1/3] Memeriksa proses yang sedang berjalan pada port 3000 dan 3001..." -ForegroundColor Cyan
& "$PSScriptRoot\scripts\stop-services-on-ports.ps1" 3000 3001

Write-Host ""
Write-Host "[2/3] Memulai proses kompilasi production (npm run build)..." -ForegroundColor Cyan
Write-Host ""

& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Red
    Write-Host "  [ERROR] Kompilasi 'npm run build' gagal!" -ForegroundColor Red
    Write-Host "  Layanan produksi tidak dijalankan. Silakan cek pesan error di atas." -ForegroundColor Red
    Write-Host "======================================================================" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  [OK] Production build berhasil dibuat!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[3/3] Menjalankan layanan produksi via run-web-qa-production.bat..." -ForegroundColor Cyan
Write-Host ""

if (Test-Path "$PSScriptRoot\run-web-qa-production.bat") {
    & cmd.exe /c "$PSScriptRoot\run-web-qa-production.bat"
} else {
    Write-Host "[ERROR] File run-web-qa-production.bat tidak ditemukan." -ForegroundColor Red
    exit 1
}
