// Настройки Prisma CLI (миграции, seed, studio).
import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// .env лежит в корне монорепо — подгружаем его явно
config({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Без ?? '' команда prisma generate падала бы, если .env ещё не создан
    url: process.env.DATABASE_URL ?? '',
  },
});
