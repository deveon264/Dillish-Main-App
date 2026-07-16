@echo off
REM ===================================================================
REM  dev-autostart.cmd - logon wrapper around dev-up.cmd
REM
REM  Run from the Startup folder so the dev servers come up automatically
REM  after every logon. Waits for the Wi-Fi/LAN connection first, and skips
REM  everything if the Expo dev server is already listening on 8081 (so a
REM  manual dev-up earlier in the day does not collide with this one).
REM ===================================================================

REM --- Skip if Expo is already running ---
netstat -ano | findstr /C:":8081" | findstr /C:"LISTENING" >nul
if not errorlevel 1 (
  echo Expo dev server is already running on port 8081 - nothing to do.
  timeout /t 5 >nul
  exit /b 0
)

REM --- Wait up to ~2 minutes for a private LAN IPv4 address ---
echo Waiting for the network connection...
set /a _tries=0
:waitnet
ipconfig | findstr /R /C:"IPv4.*192\.168\." /C:"IPv4.*10\." >nul
if not errorlevel 1 goto netup
set /a _tries+=1
if %_tries% geq 24 (
  echo No LAN connection after 2 minutes - starting anyway.
  echo The desktop QR code may be stale until Wi-Fi connects.
  goto netup
)
timeout /t 5 >nul
goto waitnet

:netup
call "%~dp0dev-up.cmd"
