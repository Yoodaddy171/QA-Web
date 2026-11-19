@echo off
setlocal
pushd "%~dp0" || exit /b 1
where node.exe >nul 2>&1
if errorlevel 1 goto :requirements
where npm.cmd >nul 2>&1
if errorlevel 1 goto :requirements
node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major === 24 || (major === 22 && minor >= 13) ? 0 : 1)"
if errorlevel 1 goto :requirements
node scripts\setup-windows.mjs %*
set "SETUP_EXIT=%ERRORLEVEL%"
if not "%SETUP_EXIT%"=="0" echo See docs\traceva-guidebook.md for manual setup and troubleshooting.
goto :finish

:requirements
echo Install Node.js 24 or Node.js 22.13+ with npm from https://nodejs.org/en/download
echo Reopen the terminal and run setup-traceva.bat again.
set "SETUP_EXIT=1"

:finish
popd
if "%~1"=="" pause
exit /b %SETUP_EXIT%
