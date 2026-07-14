@echo off
REM ===================================================================
REM  dev-up.cmd - start local dev services for Florish/Dillish
REM
REM  This helper avoids the old 5433 temporary Postgres path. The project now
REM  expects the Windows PostgreSQL service on localhost:5432 and lets
REM  npm start run safety checks + local backups before Expo launches.
REM ===================================================================

cd /d "%~dp0.."

echo Checking PostgreSQL service...
sc query postgresql-x64-17 | findstr /C:"RUNNING" >nul
if errorlevel 1 (
  echo Starting PostgreSQL service postgresql-x64-17...
  net start postgresql-x64-17
) else (
  echo PostgreSQL service is already running.
)

echo Starting object-storage sidecar (port 1106)...
start "Florish Sidecar" cmd /k node scripts\local-object-storage-sidecar.mjs

echo Starting local Whisper transcribe sidecar (port 1107)...
start "Florish Transcribe" cmd /k node scripts\local-transcribe-sidecar.mjs

echo Starting guarded Expo dev server (port 8081)...
start "Florish Expo" cmd /k npm start

echo.
echo All services launching. This PC's current LAN IP(s):
ipconfig | findstr /C:"IPv4"
echo.
echo The Expo window will create a database backup and object-storage backup
echo before showing the QR code. If it refuses to start, read the safe-start
echo error in that window instead of continuing with an empty database.
echo.
pause
