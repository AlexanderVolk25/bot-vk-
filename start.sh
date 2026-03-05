#!/usr/bin/env bash
set -e

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
    echo "  Windows:       скачайте с https://ffmpeg.org/download.html"
    echo ""
fi

# Проверяем yt-dlp
if ! command -v yt-dlp &>/dev/null; then
    echo "[ПРЕДУПРЕЖДЕНИЕ] yt-dlp не найден — скачивание видео с YouTube будет недоступно."
    echo "  Linux/macOS: pip3 install yt-dlp  ИЛИ  sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod +x /usr/local/bin/yt-dlp"
    echo "  Windows:     скачайте yt-dlp.exe с https://github.com/yt-dlp/yt-dlp/releases/latest"
    echo ""
fi

# Проверяем .env
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "[INFO] Файл .env не найден — копируем из .env.example..."
        cp .env.example .env
        echo "[ВАЖНО] Откройте файл .env и заполните токены VK перед запуском!"
        echo "  nano .env   или   gedit .env   или любой текстовый редактор"
        echo ""
        read -p "Нажмите Enter после того, как заполните .env..."
    else
        echo "[ОШИБКА] Файл .env.example не найден. Скачайте проект заново."
        exit 1
    fi
fi
echo "[OK] Файл .env найден."

# Устанавливаем зависимости
if [ ! -d "node_modules" ]; then
    echo ""
    echo "[INFO] Устанавливаем зависимости (npm install)..."
    echo "       Это может занять 1-3 минуты..."
    npm install
    echo "[OK] Зависимости установлены."
else
    echo "[OK] node_modules уже существует, пропускаем установку."
fi

# Компилируем TypeScript
echo ""
echo "[INFO] Компилируем TypeScript (npm run build)..."
npm run build
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
