# Мем-батл

Telegram Mini App — карточная игра с мемами.

## Структура

- `apps/api` — сервер (Fastify): проверка initData, REST API, позже WebSocket
- `apps/web` — Mini App (React + Vite + Tailwind)
- `apps/bot` — бот @mem_fight_bot (grammY)
- `packages/db` — Prisma-схема, миграции, seed
- `packages/shared` — общие типы, Zod-схемы и константы
- `docker/` — Docker Compose

## Первый запуск (Mac)

1. Установить pnpm: `npm install -g pnpm`
2. Создать `.env`: `cp .env.example .env` и заполнить `BOT_TOKEN`, `MINI_APP_SHORT_NAME`, `ADMIN_TELEGRAM_ID`
3. Установить зависимости: `pnpm install`
4. Запустить Docker Desktop, затем базу: `pnpm db:up`
5. Применить миграции: `pnpm db:migrate`
6. Заполнить базу: `pnpm db:seed`
7. Запустить всё сразу (API + Mini App + бот): `pnpm dev`

Открыть в Safari: http://localhost:5173 (вход без Telegram работает, пока `DEV_AUTH=true`).

## Команды

| Команда | Что делает |
|---|---|
| `pnpm dev` | API, фронтенд и бот вместе |
| `pnpm dev:api` / `dev:web` / `dev:bot` | по отдельности |
| `pnpm test` | тесты |
| `pnpm typecheck` | проверка типов во всём проекте |
| `pnpm db:studio` | просмотр базы в браузере |

## Проверка в Telegram

1. Установить туннель: `brew install cloudflared`
2. Запустить: `cloudflared tunnel --url http://localhost:5173` — он выдаст адрес `https://….trycloudflare.com`
3. В @BotFather: `/myapps` → выбрать приложение → Edit Web App URL → вставить этот адрес
4. Вписать адрес в `.env` как `WEB_APP_URL` и перезапустить `pnpm dev`
5. Открыть бота в Telegram → `/start` → «Играть»

Адрес туннеля меняется при каждом запуске cloudflared — шаги 3–4 придётся повторять.
