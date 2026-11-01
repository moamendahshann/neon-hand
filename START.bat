@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js is required: https://nodejs.org
 pause
 exit /b 1
)
if not exist node_modules (
 call npm.cmd ci
 if errorlevel 1 goto fail
)
if not exist public\assets\hand_landmarker.task (
 call npm.cmd run assets
 if errorlevel 1 goto fail
)
echo Open http://localhost:5173 - Close this window to stop the server.
start "" "http://localhost:5173"
call npm.cmd run dev
pause
exit /b
:fail
echo Setup failed. Check the internet connection and try again.
pause
