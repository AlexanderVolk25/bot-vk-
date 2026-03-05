@echo off
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
    echo Please download and install Node.js 20 LTS from:
    echo   https://nodejs.org/en/download
    echo.
    echo Check "Add to PATH" during installation, then re-run this script.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js found: %NODE_VER%

:: Check npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found. Please reinstall Node.js.
    pause
    exit /b 1
)
echo [OK] npm found.

:: Create .env from example if missing
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] .env not found - copying from .env.example...
        copy ".env.example" ".env" >nul
        echo.
        echo [ACTION REQUIRED] Fill in your VK tokens in .env before continuing.
        echo   Opening .env in Notepad now...
        echo   Save and close Notepad, then press any key here to continue.
        echo.
        notepad .env
        pause
    ) else (
        echo [ERROR] .env.example not found. Please re-download the project.
        pause
        exit /b 1
    )
)
echo [OK] .env found.

:: Install dependencies (only on first run)
if not exist "node_modules" (
    echo.
    echo [INFO] Installing dependencies (npm install)...
    echo        This may take 1-3 minutes on first run...
    npm install
    if !errorlevel! neq 0 (
        echo [ERROR] npm install failed. Check the output above.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed.
) else (
    echo [OK] node_modules already exists, skipping install.
)

:: Build TypeScript
echo.
echo [INFO] Compiling TypeScript (npm run build)...
npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed. Check the TypeScript errors above.
    pause
    exit /b 1
)

:: Verify the build actually produced the entry point
if not exist "dist\index.js" (
    echo [ERROR] dist\index.js was not created by the build.
    echo         Try deleting node_modules and re-running this script.
    pause
    exit /b 1
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
    echo [ERROR] Bot exited with error code !errorlevel!.
    echo         Check the output above for details.
)
pause
