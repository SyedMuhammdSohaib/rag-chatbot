@echo off
title Backend - DO NOT CLOSE
cd /d "%~dp0backend"
set "CACHE=%~dp0cache"
set "TEMP=%CACHE%\temp"
set "TMP=%CACHE%\temp"
set "HF_HOME=%CACHE%\hf"
set "HF_HUB_DOWNLOAD_TIMEOUT=120"
if not exist "data" mkdir "data"

rem If port 8000 is already used by an old backend, stop it first
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:"127.0.0.1:8000 .*LISTENING"') do taskkill /PID %%p /F >nul 2>&1

:loop
echo.
echo [%date% %time%] Starting backend on http://127.0.0.1:8000 ...
echo Keep this window open. Do NOT click inside it (clicking pauses it).
".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
echo.
echo [%date% %time%] Backend stopped (exit code %errorlevel%). Restarting in 5 seconds...
echo [%date% %time%] backend stopped, exit code %errorlevel% >> "data\backend-crashes.log"
echo Press Ctrl+C twice to stop it for real.
timeout /t 5 >nul
goto loop
