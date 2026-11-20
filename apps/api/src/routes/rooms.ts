import type { FastifyInstance } from 'fastify';
import type { AppConfigDto } from '@meme/shared';
import type { RoomManager } from '../game/RoomManager.ts';
import { env } from '../env.ts';

export const roomRoutes = async (app: FastifyInstance, { rooms }: { rooms: RoomManager }) => {
  // Создать комнату с друзьями → клиент получает код и подключается по WebSocket
  app.post('/rooms', async (request) => {
    const room = await rooms.create(request.user.id);
    return { code: room.code };
  });

  // Данные для ссылок-приглашений
  app.get('/config', async (): Promise<AppConfigDto> => ({
    botUsername: env.botUsername,
    miniAppShortName: env.miniAppShortName,
  }));
};
