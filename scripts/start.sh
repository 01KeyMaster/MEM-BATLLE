#!/usr/bin/env bash
# pnpm start — запускает всё одной командой:
# обновляет код, поднимает базу, применяет миграции, загружает карты,
# запускает API + Mini App + бота и туннель для телефона.
# Остановить: Ctrl+C.
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose --env-file .env -f docker/docker-compose.dev.yml"
step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m❌ %s\033[0m\n' "$1"; exit 1; }

# 1. .env
step "1/7 Проверяю .env"
if [ ! -f .env ]; then
  cp .env.example .env
  fail "Создал .env из шаблона. Заполни BOT_TOKEN и ADMIN_TELEGRAM_ID и запусти снова."
fi
grep -q '^BOT_TOKEN=.\+' .env || fail "В .env пустой BOT_TOKEN"

# 2. Свежий код с GitHub
step "2/7 Забираю обновления с GitHub"
if ! git pull --ff-only --quiet; then
  echo "Не получилось обновиться автоматически. Изменённые у тебя файлы:"
  git status --short
  fail "Пришли этот список в чат — подскажу, что сделать."
fi
git log --oneline -1

# 3. Библиотеки
step "3/7 Устанавливаю библиотеки"
pnpm install --silent

# 4. Docker
step "4/7 Запускаю Docker и базу"
if ! docker info >/dev/null 2>&1; then
  echo "Docker не запущен — открываю Docker Desktop…"
  open -a Docker 2>/dev/null || fail "Запусти Docker Desktop вручную"
  for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 2; done
  docker info >/dev/null 2>&1 || fail "Docker не запустился за 2 минуты"
fi
$COMPOSE up -d --quiet-pull

# 5. Миграции (ждём, пока база проснётся)
step "5/7 Обновляю структуру базы"
for i in $(seq 1 30); do
  if pnpm --filter @meme/db exec prisma migrate deploy >/dev/null 2>&1; then break; fi
  [ "$i" = 30 ] && fail "База не отвечает. Проверь DATABASE_URL и POSTGRES_PORT в .env"
  sleep 2
done
echo "готово"

# 6. Карты
step "6/7 Загружаю карты"
pnpm --silent db:seed 2>&1 | grep -E '✅|❌' || true
if [ -d content/packs ]; then pnpm --silent content:import || echo "⚠️  В твоих паках есть ошибки — см. выше"; fi

# 7. Запуск
step "7/7 Запускаю игру"
pids=()
cleanup() { echo; echo "Останавливаю…"; kill "${pids[@]}" 2>/dev/null || true; wait 2>/dev/null; }
trap cleanup INT TERM EXIT

pnpm dev &
pids+=($!)

if command -v cloudflared >/dev/null 2>&1; then
  sleep 5
  pnpm --silent dev:tg &
  pids+=($!)
else
  echo "⚠️  cloudflared не установлен — игра доступна только в Safari: http://localhost:5173"
  echo "   Для телефона: brew install cloudflared"
fi

echo
echo "✅ Всё запущено. Safari: http://localhost:5173 · Телефон: @mem_fight_bot → «Играть»"
echo "   Остановить — Ctrl+C"
wait
