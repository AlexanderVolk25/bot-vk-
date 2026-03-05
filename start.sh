#!/usr/bin/env bash
cd "$(dirname "$0")" || { echo "[ОШИБКА] Не удалось перейти в директорию скрипта."; exit 1; }

echo ""
echo " =========================================="
echo "  GoldMine VK Bot — Запуск без Docker"
echo " =========================================="
echo ""

# Проверяем Node.js
if ! command -v node &>/dev/null; then
    echo "[ОШИБКА] Node.js не найден!"
    echo "Установите Node.js 20 LTS:"
    echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  macOS:         brew install node@20"
    echo "  Или скачайте с https://nodejs.org/en/download"
    exit 1
fi
echo "[OK] Node.js $(node -v) найден."

# Проверяем npm
if ! command -v npm &>/dev/null; then
    echo "[ОШИБКА] npm не найден. Переустановите Node.js."
    exit 1
fi
echo "[OK] npm $(npm -v) найден."

# Проверяем ffmpeg
if ! command -v ffmpeg &>/dev/null; then
    echo "[ПРЕДУПРЕЖДЕНИЕ] ffmpeg не найден — обработка видео будет недоступна."
    echo "  Ubuntu/Debian: sudo apt-get install -y ffmpeg"
    echo "  macOS:         brew install ffmpeg"
    echo ""
fi

# Проверяем yt-dlp
if ! command -v yt-dlp &>/dev/null; then
    echo "[ПРЕДУПРЕЖДЕНИЕ] yt-dlp не найден — скачивание видео с YouTube будет недоступно."
    echo "  Linux/macOS: pip3 install yt-dlp"
    echo ""
fi

# Проверяем .env
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo ""
        echo "[ACTION REQUIRED] Файл .env создан из .env.example."
        echo "  Откройте .env и заполните токены VK:"
        echo "    nano .env"
        echo ""
        echo "  После заполнения запустите скрипт снова."
        exit 0
    else
        echo "[ОШИБКА] Файл .env.example не найден. Скачайте проект заново."
        exit 1
    fi
fi
echo "[OK] Файл .env найден."

# Устанавливаем зависимости (проверяем наличие tsc как признак полной установки)
if [ ! -f "node_modules/.bin/tsc" ]; then
    echo ""
    echo "[INFO] Устанавливаем зависимости (~1-3 минуты при первом запуске)..."
    npm install --include=dev
    if [ $? -ne 0 ]; then
        echo "[ОШИБКА] npm install завершился с ошибкой."
        exit 1
    fi
    echo "[OK] Зависимости установлены."
fi

# Компилируем TypeScript
echo ""
echo "[INFO] Компилируем TypeScript..."
npm run build
if [ $? -ne 0 ]; then
    echo "[ОШИБКА] Сборка завершилась с ошибкой. Проверьте ошибки выше."
    exit 1
fi
if [ ! -f "dist/index.js" ]; then
    echo "[ОШИБКА] dist/index.js не создан. Проверьте tsconfig.json или запустите: npm run build"
    exit 1
fi
echo "[OK] Сборка успешна."

# Создаём нужные папки
mkdir -p data logs

# Запускаем
echo ""
echo " =========================================="
echo "  Бот запущен!"
echo "  Админ-панель: http://localhost:3000"
echo "  Для остановки нажмите Ctrl+C"
echo " =========================================="
echo ""

node dist/index.js
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "[ОШИБКА] Бот завершился с кодом $EXIT_CODE."
    echo "  Проверьте вывод выше для деталей."
fi
