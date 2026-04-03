@echo off
setlocal enabledelayedexpansion

REM Copilot Wrapper - Manages session isolation for GitHub Copilot CLI
REM Usage: copilot_wrapper.bat <output_file> <session_dir> <working_dir> <request_or_file> [model] [version_enabled] [agent_name]
REM
REM If request_or_file starts with @, it's treated as a file path containing the prompt.
REM Otherwise, it's treated as the prompt string directly.
REM Model is optional - if provided, passed to copilot with --model flag.
REM version_enabled: "true" to git add + commit after copilot runs (optional)
REM agent_name: name of the agent for commit messages (optional)
REM
REM This wrapper:
REM   1. Acquires file lock (mutual exclusion)
REM   2. Gets/creates deterministic UUID for session_dir (stored in session.uuid)
REM   3. Moves session from session_dir into copilot cache
REM   4. Runs copilot command with --resume <uuid> [--model <model>]
REM   4.5. If version_enabled: git add -A && git commit
REM   5. Moves session back from copilot cache to session_dir
REM   6. Releases lock
REM
REM Result: Copilot's cache stays clean, sessions live in session_dir

SET "OUTPUT_FILE=%~1"
SET "SESSION_DIR=%~2"
SET "WORKING_DIR=%~3"
SET "REQUEST_OR_FILE=%~4"
SET "MODEL=%~5"
SET "VERSION_ENABLED=%~6"
SET "AGENT_NAME=%~7"

REM Check if request is a file reference (starts with @)
SET "PROMPT_FILE="
SET "REQUEST="
echo !REQUEST_OR_FILE! | findstr /b "@" >nul
if !errorlevel! equ 0 (
    REM It's a file reference, extract path after @
    SET "PROMPT_FILE=!REQUEST_OR_FILE:~1!"
) else (
    SET "REQUEST=!REQUEST_OR_FILE!"
)

REM Copilot session cache location
SET "COPILOT_CACHE=%USERPROFILE%\.copilot\session-state"
SET "LOCK_FILE=%USERPROFILE%\.zoltbot\copilot.lock"
SET "UUID_FILE=%SESSION_DIR%\session.uuid"

REM Ensure directories exist
if not exist "%USERPROFILE%\.zoltbot" mkdir "%USERPROFILE%\.zoltbot"
if not exist "%COPILOT_CACHE%" mkdir "%COPILOT_CACHE%"
if not exist "%SESSION_DIR%" mkdir "%SESSION_DIR%"

REM =========================================
REM Step 1: Acquire lock (spin wait with stale lock recovery)
REM   If the lock file is older than 20 minutes, a previous process
REM   likely crashed without releasing it. Force-remove and retry.
REM =========================================
if exist "%LOCK_FILE%" (
    for /f "tokens=*" %%a in ('powershell -NoProfile -Command "if ((Get-Item '%LOCK_FILE%').LastWriteTime -lt (Get-Date).AddMinutes(-20)) { Write-Output 'STALE' }"') do (
        if "%%a"=="STALE" (
            del "%LOCK_FILE%" 2>nul
        )
    )
)
:acquire_lock
2>nul (
    >"%LOCK_FILE%" (
        echo %DATE% %TIME%
    )
) || (
    timeout /t 1 /nobreak >nul
    goto acquire_lock
)

REM =========================================
REM Step 2: Get or create deterministic UUID for this session_dir
REM =========================================
SET "SESSION_UUID="
if exist "%UUID_FILE%" (
    REM Read existing UUID
    set /p SESSION_UUID=<"%UUID_FILE%"
) else (
    REM Generate new UUID and save it
    for /f "tokens=*" %%a in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString()"') do (
        SET "SESSION_UUID=%%a"
    )
    echo !SESSION_UUID!>"%UUID_FILE%"
)

SET "CACHE_SESSION_PATH=%COPILOT_CACHE%\!SESSION_UUID!"

REM =========================================
REM Step 3: Move session from session_dir into copilot cache
REM =========================================
if exist "%SESSION_DIR%\workspace.yaml" (
    REM Clean target first
    if exist "!CACHE_SESSION_PATH!" rmdir /s /q "!CACHE_SESSION_PATH!" 2>nul
    
    REM Move session to copilot cache (keeping uuid file in session_dir)
    mkdir "!CACHE_SESSION_PATH!" 2>nul
    for %%f in ("%SESSION_DIR%\*") do (
        if /i not "%%~nxf"=="session.uuid" (
            move /y "%%f" "!CACHE_SESSION_PATH!\" >nul 2>&1
        )
    )
    for /d %%d in ("%SESSION_DIR%\*") do (
        robocopy "%%d" "!CACHE_SESSION_PATH!\%%~nxd" /E /MOVE /NFL /NDL /NJH /NJS >nul 2>&1
    )
)

REM =========================================
REM Step 4: Run copilot command
REM =========================================
cd /d "%WORKING_DIR%"

REM Build model flag if specified
SET "MODEL_FLAG="
if defined MODEL (
    SET "MODEL_FLAG=--model !MODEL!"
)

REM If prompt is in a file, pipe it to copilot via stdin
if defined PROMPT_FILE (
    type "!PROMPT_FILE!" | call copilot --allow-all --resume !SESSION_UUID! !MODEL_FLAG! > "%OUTPUT_FILE%" 2>&1
) else (
    call copilot -p "%REQUEST%" --allow-all --resume !SESSION_UUID! !MODEL_FLAG! > "%OUTPUT_FILE%" 2>&1
)

REM =========================================
REM Step 4.1: Log prompt and response (rotating)
REM =========================================
SET "LOG_DIR=%USERPROFILE%\.zoltbot\copilot-logs"
if not exist "!LOG_DIR!" mkdir "!LOG_DIR!"

REM Determine agent name for log file
SET "LOG_AGENT=unknown"
if defined AGENT_NAME SET "LOG_AGENT=!AGENT_NAME!"

REM Rotating log: keep last 50 entries per agent, one file per call
for /f "tokens=*" %%t in ('powershell -NoProfile -Command "Get-Date -Format 'yyyyMMdd-HHmmss'"') do SET "LOG_TS=%%t"
SET "LOG_FILE=!LOG_DIR!\!LOG_AGENT!_!LOG_TS!.log"

REM Write prompt
echo === PROMPT (!LOG_TS!) === > "!LOG_FILE!"
echo Agent: !LOG_AGENT! >> "!LOG_FILE!"
echo Working Dir: %WORKING_DIR% >> "!LOG_FILE!"
echo --- >> "!LOG_FILE!"
if defined PROMPT_FILE (
    type "!PROMPT_FILE!" >> "!LOG_FILE!" 2>nul
) else (
    echo %REQUEST% >> "!LOG_FILE!"
)
echo. >> "!LOG_FILE!"
echo === RESPONSE === >> "!LOG_FILE!"
type "%OUTPUT_FILE%" >> "!LOG_FILE!" 2>nul
echo. >> "!LOG_FILE!"
echo === END === >> "!LOG_FILE!"

REM Rotate: keep only last 50 log files per agent
for /f "skip=50 tokens=*" %%f in ('dir /b /o-d "!LOG_DIR!\!LOG_AGENT!_*.log" 2^>nul') do (
    del "!LOG_DIR!\%%f" 2>nul
)

REM =========================================
REM Step 4.2: Clean output — filter noise and ensure JSON format
REM   Raw output is already logged above for debugging.
REM   This cleans the OUTPUT_FILE so the caller gets valid JSON.
REM =========================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0clean_copilot_output.ps1" "%OUTPUT_FILE%"

REM =========================================
REM Step 4.5: Version control — commit copilot's changes
REM =========================================
if /i "!VERSION_ENABLED!"=="true" (
    pushd "%WORKING_DIR%"
    
    SET "COMMIT_AGENT=agent"
    if defined AGENT_NAME SET "COMMIT_AGENT=!AGENT_NAME!"
    
    git add -A >nul 2>&1
    git diff --cached --quiet >nul 2>&1
    if !errorlevel! neq 0 (
        git commit -m "[!COMMIT_AGENT!] artifact update" >nul 2>&1
    )
    
    popd
)

REM =========================================
REM Step 5: Move session back from copilot cache to session_dir
REM =========================================
if exist "!CACHE_SESSION_PATH!" (
    REM Move all files except we preserve the uuid file
    for %%f in ("!CACHE_SESSION_PATH!\*") do (
        move /y "%%f" "%SESSION_DIR%\" >nul 2>&1
    )
    for /d %%d in ("!CACHE_SESSION_PATH!\*") do (
        robocopy "%%d" "%SESSION_DIR%\%%~nxd" /E /MOVE /NFL /NDL /NJH /NJS >nul 2>&1
    )
    
    REM Remove empty cache directory
    rmdir "!CACHE_SESSION_PATH!" 2>nul
)

REM =========================================
REM Step 6: Release lock
REM =========================================
del "%LOCK_FILE%" 2>nul

endlocal
