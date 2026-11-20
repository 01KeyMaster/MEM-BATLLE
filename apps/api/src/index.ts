import { mkdirSync } from 'node:fs';
import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { createPrisma } from '@meme/db';
import { env } from './env.ts';
import { authPlugin } from './auth/plugin.ts';
import { meRoutes } from './routes/me.ts';
import { collectionRoutes } from './routes/collection.ts';
import { createCollectionService } from './services/collection.ts';
import { roomRoutes } from './routes/rooms.ts';
import { createRoomManager } from './game/RoomManager.ts';
import { createGateway } from './ws/gateway.ts';

const prisma = createPrisma();
const collection = createCollectionService(prisma);
const gateway = createGateway();
const rooms = createRoomManager({ prisma, collection, winScore: env.winScore, onChange: gateway.broadcast });

const app = Fastify({
  logger: {
    // Никогда не пишем в логи заголовок авторизации (там initData)
    redact: ['req.headers.authorization'],
  },
});

await app.register(cors, { origin: env.webOrigin });

// Внутренние ошибки пишем в лог, а клиенту отдаём только общее сообщение
app.setErrorHandler((error: FastifyError, request, reply) => {
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

// Игра в реальном времени: /ws (авторизация — первым сообщением)
await app.register(websocket, { options: { maxPayload: 16 * 1024 } });
gateway.register(app, { prisma, rooms });

// Всё под /api — только для авторизованных через Telegram
await app.register(
  async (api) => {
    await api.register(authPlugin, { prisma });
    await api.register(meRoutes);
    await api.register(collectionRoutes, { collection });
    await api.register(roomRoutes, { rooms });
  },
  { prefix: '/api' },
);

if (env.devAuth) app.log.warn('⚠️  DEV_AUTH включён: вход без Telegram разрешён (только для разработки)');

const stale = await rooms.closeStale();
if (stale) app.log.info(`Закрыто незавершённых комнат после перезапуска: ${stale}`);

const shutdown = async () => {
  rooms.disposeAll();
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: env.port, host: '0.0.0.0' });
