@echo off
:: Keep the console window open on exit.
:: When double-clicked, relaunches itself via cmd /k so the CMD window stays open
:: after the script finishes. The user only sees one window; type EXIT to close it.
if /i not "%~1"=="--keepopen" (
    cmd /k ""%~dpnx0" --keepopen"
    exit /b
)
setlocal enabledelayedexpansion
cd /d "%~dp0"
title GoldMine VK Bot

echo.
echo  ==========================================
echo   GoldMine VK Bot - Launch without Docker
echo  ==========================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found!
    echo         Download: https://nodejs.org/en/download
    echo         Enable "Add to PATH" during install, then re-run.
    goto :done
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER%

:: Check npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found. Reinstall Node.js.
    goto :done
)
echo [OK] npm found.

:: Create .env from example if missing
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo.
        echo [ACTION REQUIRED] .env created from .env.example.
        echo         Open .env and fill in your VK tokens:
        echo           %~dp0.env
        echo.
        echo         Save .env, then run this script again.
        goto :done
    ) else (
        echo [ERROR] .env.example not found. Re-download the project.
        goto :done
    )
)
echo [OK] .env found.

:: Install dependencies if missing or incomplete (tsc.cmd as devDep sentinel)
if not exist "node_modules\.bin\tsc.cmd" (
    echo.
    echo [INFO] Installing dependencies (~1-3 min on first run)...
    npm install --include=dev
    if !errorlevel! neq 0 (
        echo [ERROR] npm install failed. Check the output above.
        goto :done
    )
    echo [OK] Dependencies installed.
)

:: Build TypeScript
echo.
echo [INFO] Compiling TypeScript...
npm run build
if !errorlevel! neq 0 (
    echo [ERROR] Build failed. Check the TypeScript errors above.
    goto :done
)
if not exist "dist\index.js" (
    echo [ERROR] dist\index.js was not created. Delete node_modules and retry.
    goto :done
)
echo [OK] Build successful.

:: Ensure data and log directories exist
if not exist "data" mkdir data
if not exist "logs" mkdir logs

:: Launch bot
echo.
echo  ==========================================
echo   Bot is running!
echo   Admin panel: http://localhost:3000
echo   Press Ctrl+C to stop.
echo  ==========================================
echo.

node dist\index.js

if !errorlevel! neq 0 (
    echo.
    echo [ERROR] Bot exited with code !errorlevel!.
    echo         Check the output above for details.
)

:done
echo.
echo  Script finished. Type EXIT to close this window.
echo.
