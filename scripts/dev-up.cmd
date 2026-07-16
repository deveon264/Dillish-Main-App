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

REM Pass "tunnel" as the first argument (dev-up.cmd tunnel) to publish the
REM dev server at a public https://...exp.direct URL so phones outside this
REM network (other countries, mobile data) can open it in Expo Go.
REM NOTE: no unescaped ( ) in echo text inside these blocks - cmd treats a
REM bare ) as the end of the block and aborts with "... was unexpected".
if /i "%~1"=="tunnel" (
  echo Starting guarded Expo dev server in TUNNEL mode - public exp.direct URL...
  start "Florish Expo (tunnel)" cmd /k node scripts\safe-expo-start.mjs -- --tunnel --port 8081
) else (
  echo Starting guarded Expo dev server on port 8081, LAN mode...
  start "Florish Expo" cmd /k npm start
  echo Refreshing the Expo Go QR code on the desktop - florish-dev-qr.png...
  node scripts\write-dev-qr.mjs
)

echo.
echo All services launching. This PC's current LAN IP(s):
ipconfig | findstr /C:"IPv4"
echo.
if /i not "%~1"=="tunnel" (
  echo If the phone's saved entry in Expo Go times out, the PC's IP changed:
  echo scan the fresh QR code saved on the desktop as florish-dev-qr.png.
  echo.
)
echo The Expo window will create a database backup and object-storage backup
echo before showing the QR code. If it refuses to start, read the safe-start
echo error in that window instead of continuing with an empty database.
echo.
pause
