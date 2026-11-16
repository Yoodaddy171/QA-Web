param(
    [int[]]$Ports = @(3000, 3001)
)

$killedCount = 0

foreach ($port in $Ports) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 4 }
        if ($conns) {
            $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
            foreach ($procId in $pids) {
                $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
                if ($proc) {
                    Write-Host "[STOP] Menghentikan $($proc.ProcessName) (PID: $procId) pada port $port..." -ForegroundColor Yellow
                    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                    $killedCount++
                }
            }
        } else {
            Write-Host "[OK] Port $port bebas." -ForegroundColor Green
        }
    } catch {
        Write-Warning "Gagal memeriksa port ${port}: $($_.Exception.Message)"
    }
}

if ($killedCount -gt 0) {
    Start-Sleep -Seconds 1
    Write-Host "[OK] $killedCount proses telah dihentikan dan port siap digunakan kembali." -ForegroundColor Green
}
