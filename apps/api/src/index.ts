import { mkdirSync } from 'node:fs';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { createPrisma, CardType } from '@meme/db';
import { env } from './env.ts';

const prisma = createPrisma();
const app = Fastify({ logger: true });

// Картинки карт: /uploads/cards/base/meme-01.svg
mkdirSync(env.uploadsDir, { recursive: true });
await app.register(fastifyStatic, { root: env.uploadsDir, prefix: '/uploads/' });

// Проверка, что API живой и видит базу
app.get('/health', async () => {
  const [packs, memes, situations] = await Promise.all([
    prisma.pack.count(),
    prisma.card.count({ where: { type: CardType.MEME } }),
    prisma.card.count({ where: { type: CardType.SITUATION } }),
  ]);
  return { ok: true, packs, memes, situations };
});

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: env.port, host: '0.0.0.0' });
