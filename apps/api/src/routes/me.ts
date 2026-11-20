import type { FastifyInstance } from 'fastify';
import type { Me } from '@meme/shared';
import { isAdmin } from '../auth/plugin.ts';

export const meRoutes = async (app: FastifyInstance) => {
  // Профиль текущего пользователя
  app.get('/me', async (request): Promise<Me> => {
    const u = request.user;
    return {
      id: u.id,
      telegramId: u.telegramId.toString(),
      firstName: u.firstName,
      username: u.username,
      photoUrl: u.photoUrl,
      isAdmin: isAdmin(u),
      stats: { gamesPlayed: u.gamesPlayed, gamesWon: u.gamesWon, roundsWon: u.roundsWon },
    };
  });
};
