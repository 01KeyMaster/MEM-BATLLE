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
| `pnpm content:import` | загрузить паки из папки `content/packs` (или `pnpm content:import <папка>` — один пак) |

## Проверка в Telegram (на телефоне)

1. Один раз: `brew install cloudflared`
2. В одном терминале: `pnpm dev`
3. Во втором терминале: `pnpm dev:tg` — сам запустит туннель, запишет адрес в `.env` и настроит бота
4. На телефоне: открыть @mem_fight_bot → кнопка «Играть» слева от поля ввода (или `/start`)

Оба терминала должны оставаться открытыми. `/newapp` в BotFather для разработки не нужен —
он понадобится для ссылок-приглашений `t.me/mem_fight_bot/<app>?startapp=...` (этап 4).

## Свои паки

1. Скопируй пример: `cp -r content-example content`
2. Папка `content/packs/<имя>` = один пак. Имя — латиница, цифры, дефис (оно попадёт в id карт — не меняй его потом).
3. В `pack.json` — название, цена в Stars (0 = бесплатно), редкость и **source/license** для каждой картинки.
4. `situations.txt` — ситуации, по одной на строку.
5. Картинки — в `memes/`, вертикальные 4:5, webp/png/jpg, до 1 МБ.
6. `pnpm content:import`

Папка `content/` не попадает в git — картинки платных паков не утекут.
Убрал мем из pack.json → после импорта карта выключится (из истории игр не удаляется).
