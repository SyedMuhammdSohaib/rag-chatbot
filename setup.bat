@echo off
setlocal
cd /d "%~dp0"
title RAG chatbot - one-time setup
echo ============================================================
echo  RAG chatbot - one-time setup
echo  Everything is installed inside this folder (no C: drive use)
echo ============================================================
echo.

rem ---- keep caches and temp files on this drive ----
set "CACHE=%~dp0cache"
if not exist "%CACHE%\temp" mkdir "%CACHE%\temp"
set "TEMP=%CACHE%\temp"
set "TMP=%CACHE%\temp"
set "PIP_CACHE_DIR=%CACHE%\pip"
set "npm_config_cache=%CACHE%\npm"
set "npm_config_fetch_retries=6"
set "npm_config_fetch_retry_maxtimeout=120000"
set "HF_HOME=%CACHE%\hf"
set "HF_HUB_DOWNLOAD_TIMEOUT=120"
set "OLLAMA_MODELS=%~dp0ollama-models"
if not exist "%OLLAMA_MODELS%" mkdir "%OLLAMA_MODELS%"

rem ---- check tools ----
rem ---- find a suitable Python (3.10-3.12). Looks on E: first, then the py launcher ----
set "PY="
if exist "E:\Python312\python.exe" set "PY=E:\Python312\python.exe"
if not defined PY if exist "%~dp0python312\python.exe" set "PY=%~dp0python312\python.exe"
if not defined PY (
  py -3.12 -c "import sys" >nul 2>&1
  if not errorlevel 1 set "PY=py -3.12"
)
if not defined PY (
  py -3.11 -c "import sys" >nul 2>&1
  if not errorlevel 1 set "PY=py -3.11"
)
if not defined PY set "PY=python"
%PY% -c "import sys; sys.exit(0 if (3,10) <= sys.version_info[:2] <= (3,12) else 1)" >nul 2>&1
if errorlevel 1 (
  echo [X] No Python 3.10-3.12 found. Your PC only has a newer Python, which will not work.
  echo     Install Python 3.12 to E:\Python312 ^(see README^) and run setup.bat again.
  pause
  exit /b 1
)
echo Using Python:
%PY% --version
call node --version >nul 2>&1
if errorlevel 1 (
  echo [X] Node.js not found. Install Node.js 20 LTS, then run setup.bat again.
  pause
  exit /b 1
)
rem ---- config file + which chat provider (ollama = local, groq = free online) ----
if not exist "backend\.env" copy "backend\.env.example" "backend\.env" >nul
set "USE_OLLAMA=1"
findstr /B /C:"LLM_PROVIDER=groq" "backend\.env" >nul 2>&1 && set "USE_OLLAMA="
if not defined USE_OLLAMA (
  echo Chat provider: Groq ^(online, free^). Ollama is NOT needed.
  goto skipollamacheck
)
echo Chat provider: Ollama ^(local^)
set "OLLAMA_EXE=ollama"
if exist "%~dp0ollama\ollama.exe" set "OLLAMA_EXE=%~dp0ollama\ollama.exe"
"%OLLAMA_EXE%" --version >nul 2>&1
if errorlevel 1 (
  echo [X] Ollama not found. Put ollama.exe in the "ollama" folder next to this file ^(see README^).
  echo     Or use the free online model instead: set LLM_PROVIDER=groq in backend\.env ^(see README^).
  pause
  exit /b 1
)
:skipollamacheck

rem ---- 1. python packages ----
echo.
echo [1/5] Python packages ^(may take a while on slow internet, it retries by itself^)...
if exist "backend\.venv\Scripts\python.exe" (
  "backend\.venv\Scripts\python.exe" -c "import sys; sys.exit(0 if (3,10) <= sys.version_info[:2] <= (3,12) else 1)" >nul 2>&1
  if errorlevel 1 (
    echo Old environment uses a wrong Python version, recreating it...
    rmdir /s /q backend\.venv
  )
)
if not exist "backend\.venv\Scripts\python.exe" %PY% -m venv backend\.venv
if not exist "backend\.venv\Scripts\python.exe" (
  echo [X] Could not create the Python environment.
  pause
  exit /b 1
)
set TRIES=0
:piptry
set /a TRIES+=1
"backend\.venv\Scripts\python.exe" -m pip install --timeout 100 --retries 10 -r backend\requirements.txt
if errorlevel 1 (
  if %TRIES% LSS 6 (
    echo Download problem, trying again ^(%TRIES%/6^)...
    goto piptry
  )
  echo [X] pip failed. Check your internet and run setup.bat again - it continues where it stopped.
  pause
  exit /b 1
)

rem ---- 2. config file ----
if not exist "backend\.env" copy "backend\.env.example" "backend\.env" >nul

rem ---- 3. embedding model ----
echo.
echo [2/5] Embedding model ^(about 130 MB, one time^)...
set TRIES=0
:embtry
set /a TRIES+=1
pushd backend
".venv\Scripts\python.exe" -c "from app.llm import _get_embedder; _get_embedder(); print('embedding model ready')"
set EMBERR=%errorlevel%
popd
if not "%EMBERR%"=="0" (
  if %TRIES% LSS 6 (
    echo Download problem, trying again ^(%TRIES%/6^)...
    goto embtry
  )
  echo [X] Embedding model download failed. Run setup.bat again later.
  pause
  exit /b 1
)

rem ---- 4. frontend ----
echo.
echo [3/5] Frontend packages...
pushd frontend
set TRIES=0
:npmtry
set /a TRIES+=1
call npm install
if errorlevel 1 (
  if %TRIES% LSS 4 (
    echo Download problem, trying again ^(%TRIES%/4^)...
    goto npmtry
  )
  echo [X] npm install failed. Run setup.bat again.
  popd
  pause
  exit /b 1
)
echo.
echo [4/5] Building frontend...
call npm run build
if errorlevel 1 (
  echo [X] Frontend build failed. Send me the error above.
  popd
  pause
  exit /b 1
)
popd

if not defined USE_OLLAMA goto skipmodel
rem ---- 5. chat model ----
echo.
echo [5/5] Chat model llama3.2:1b ^(about 1.3 GB, one time^)...
taskkill /IM "ollama app.exe" /F >nul 2>&1
taskkill /IM ollama.exe /F >nul 2>&1
start "Ollama" /min cmd /c ""%OLLAMA_EXE%" serve"
timeout /t 8 /nobreak >nul
set TRIES=0
:pulltry
set /a TRIES+=1
"%OLLAMA_EXE%" pull llama3.2:1b
if errorlevel 1 (
  if %TRIES% LSS 15 (
    echo Download problem, trying again ^(%TRIES%/15^)...
    timeout /t 5 /nobreak >nul
    goto pulltry
  )
  echo [X] Model download failed. Run setup.bat again - it continues where it stopped.
  pause
  exit /b 1
)
taskkill /IM ollama.exe /F >nul 2>&1

:skipmodel

if not defined USE_OLLAMA (
  findstr /B /C:"GROQ_API_KEY=gsk_" "backend\.env" >nul 2>&1
  if errorlevel 1 echo [!] Put your free Groq key in backend\.env ^(GROQ_API_KEY=gsk_...^) before start.bat
)
echo.
echo ============================================================
echo  SETUP DONE. Now double-click start.bat
echo ============================================================
pause
