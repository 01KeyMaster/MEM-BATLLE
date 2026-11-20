# Мем-батл

Telegram Mini App — карточная игра с мемами.

## Структура

- `apps/api` — сервер (Fastify, позже WebSocket)
- `apps/web` — Mini App (React) — появится на этапе 2
- `apps/bot` — бот (grammY) — появится на этапе 2
- `packages/db` — Prisma-схема, миграции, seed
- `packages/shared` — общие типы и константы
- `docker/` — Docker Compose

## Первый запуск (Mac)

1. Установить pnpm: `npm install -g pnpm`
2. Создать `.env`: `cp .env.example .env`
3. Установить зависимости: `pnpm install`
4. Запустить Docker Desktop, затем базу: `pnpm db:up`
5. Применить миграции: `pnpm db:migrate`
6. Заполнить базу: `pnpm db:seed`
7. Запустить API: `pnpm dev:api` → открыть http://localhost:3000/health

Посмотреть базу в браузере: `pnpm db:studio`.
