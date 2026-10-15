@echo off
setlocal
cd /d "%~dp0"
title RAG chatbot - start
set "OLLAMA_MODELS=%~dp0ollama-models"
set "OLLAMA_EXE=ollama"
if exist "%~dp0ollama\ollama.exe" set "OLLAMA_EXE=%~dp0ollama\ollama.exe"

set "USE_OLLAMA=1"
findstr /B /C:"LLM_PROVIDER=groq" "backend\.env" >nul 2>&1 && set "USE_OLLAMA="
if not defined USE_OLLAMA goto skipollama

echo Starting Ollama ^(local AI model^)...
rem always restart Ollama ourselves so the model folder on this drive is used
taskkill /IM "ollama app.exe" /F >nul 2>&1
taskkill /IM ollama.exe /F >nul 2>&1
start "Ollama" /min cmd /c ""%OLLAMA_EXE%" serve"
timeout /t 7 /nobreak >nul

"%OLLAMA_EXE%" list | findstr /C:"llama3.2:1b" >nul
if errorlevel 1 (
  echo Chat model missing, downloading it now ^(1.3 GB^)...
  "%OLLAMA_EXE%" pull llama3.2:1b
)
:skipollama

echo Starting backend and frontend...
start "Backend" /min cmd /k call "%~dp0run-backend.bat"
start "Frontend" /min cmd /k call "%~dp0run-frontend.bat"

echo Waiting for the backend to be ready...
set TRIES=0
:waitbackend
set /a TRIES+=1
timeout /t 2 /nobreak >nul
curl -s http://127.0.0.1:8000/health | findstr "ok" >nul
if not errorlevel 1 goto backendready
if %TRIES% LSS 30 goto waitbackend
echo [X] Backend did not start. Open the "Backend" window in the taskbar and send a screenshot of it.
pause
exit /b 1
:backendready
echo Backend is ready.
timeout /t 3 /nobreak >nul
start http://localhost:3000
echo.
echo App is running. The Backend and Frontend windows are minimized in the taskbar.
echo Do not close them. If chat says NetworkError, just run start.bat again.
echo To stop everything run stop.bat
timeout /t 5 /nobreak >nul
