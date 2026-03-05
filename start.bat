@echo off
chcp 65001 >nul
title GoldMine VK Bot

echo.
echo  ==========================================
echo   GoldMine VK Bot — Запуск без Docker
echo  ==========================================
echo.

:: Проверяем Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ОШИБКА] Node.js не найден!
    echo Скачайте и установите Node.js 20 LTS с сайта:
    echo   https://nodejs.org/en/download
    echo.
    pause
    exit /b 1
)

for /f "tokens=1 delims=v" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js найден: %NODE_VER%

:: Проверяем npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ОШИБКА] npm не найден. Переустановите Node.js.
    pause
    exit /b 1
)
echo [OK] npm найден.

:: Проверяем .env
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Файл .env не найден — копируем из .env.example...
        copy ".env.example" ".env" >nul
        echo [ВАЖНО] Откройте файл .env в блокноте и заполните токены VK!
        echo.
        echo Нажмите Enter после того, как заполните .env...
        notepad .env
        pause
    ) else (
        echo [ОШИБКА] Файл .env.example не найден. Скачайте проект заново.
        pause
        exit /b 1
    )
)
echo [OK] Файл .env найден.

:: Устанавливаем зависимости
if not exist "node_modules" (
    echo.
    echo [INFO] Устанавливаем зависимости (npm install)...
    echo        Это может занять 1-3 минуты...
    npm install
    if %errorlevel% neq 0 (
        echo [ОШИБКА] npm install завершился с ошибкой.
        pause
        exit /b 1
    )
    echo [OK] Зависимости установлены.
) else (
    echo [OK] node_modules уже существует, пропускаем установку.
)

:: Собираем TypeScript
echo.
echo [INFO] Компилируем TypeScript (npm run build)...
npm run build
if %errorlevel% neq 0 (
    echo [ОШИБКА] Сборка завершилась с ошибкой.
    pause
    exit /b 1
)
echo [OK] Сборка успешна.

:: Создаём нужные папки
if not exist "data" mkdir data
if not exist "logs" mkdir logs

:: Запускаем бота
echo.
echo  ==========================================
echo   Бот запущен!
echo   Админ-панель: http://localhost:3000
echo   Для остановки нажмите Ctrl+C
echo  ==========================================
echo.

node dist/index.js

pause
