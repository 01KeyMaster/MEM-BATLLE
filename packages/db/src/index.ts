// Общий Prisma-клиент для api и bot.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.ts';

export * from './generated/prisma/client.ts';

export const createPrisma = (databaseUrl = process.env.DATABASE_URL) => {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL не задан. Проверь файл .env в корне проекта.');
  }
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
};
