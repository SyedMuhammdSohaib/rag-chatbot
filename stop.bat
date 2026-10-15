@echo off
echo Stopping the app...
taskkill /FI "WINDOWTITLE eq Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend*" /T /F >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:"127.0.0.1:8000 .*LISTENING"') do taskkill /PID %%p /F >nul 2>&1
taskkill /IM ollama.exe /F >nul 2>&1
echo Done.
timeout /t 3 /nobreak >nul
