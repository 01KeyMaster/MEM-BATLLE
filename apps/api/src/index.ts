import { mkdirSync } from 'node:fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { createPrisma } from '@meme/db';
import { env } from './env.ts';
import { authPlugin } from './auth/plugin.ts';
import { meRoutes } from './routes/me.ts';

const prisma = createPrisma();

const app = Fastify({
  logger: {
    // Никогда не пишем в логи заголовок авторизации (там initData)
    redact: ['req.headers.authorization'],
  },
});

await app.register(cors, { origin: env.webOrigin });

// Внутренние ошибки пишем в лог, а клиенту отдаём только общее сообщение
app.setErrorHandler((error, request, reply) => {
  const status = error.statusCode ?? 500;
  if (status >= 500) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Ошибка сервера' });
  }
  return reply.code(status).send({ error: error.message });
});

// Картинки карт: /uploads/cards/base/meme-01.svg — публичные, без авторизации
mkdirSync(env.uploadsDir, { recursive: true });
await app.register(fastifyStatic, { root: env.uploadsDir, prefix: '/uploads/' });

app.get('/health', async () => ({ ok: true }));

// Всё под /api — только для авторизованных через Telegram
await app.register(
  async (api) => {
    await api.register(authPlugin, { prisma });
    await api.register(meRoutes);
  },
  { prefix: '/api' },
);

if (env.devAuth) app.log.warn('⚠️  DEV_AUTH включён: вход без Telegram разрешён (только для разработки)');

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: env.port, host: '0.0.0.0' });
