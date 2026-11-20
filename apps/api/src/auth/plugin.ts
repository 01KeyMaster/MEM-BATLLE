// Fastify-плагин: проверяет заголовок Authorization у каждого запроса
// и кладёт проверенного пользователя в request.user.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { AUTH_SCHEME } from '@meme/shared';
import type { PrismaClient, User } from '@meme/db';
import { env } from '../env.ts';
import { InitDataError, validateInitData, type TelegramUser } from './initData.ts';

declare module 'fastify' {
  interface FastifyRequest {
    user: User;
    startParam?: string;
  }
}

export class AuthError extends Error {}

// Достаём данные Telegram из заголовка. userId берём ТОЛЬКО из проверенных данных.
export const parseAuthHeader = (header: string | undefined) => {
  if (!header) throw new AuthError('Нет заголовка Authorization');
  const [scheme, ...rest] = header.split(' ');
  const value = rest.join(' ');

  if (scheme === AUTH_SCHEME.TELEGRAM) {
    try {
      return validateInitData(value, env.botToken);
    } catch (err) {
      if (err instanceof InitDataError) throw new AuthError(err.message);
      throw err;
    }
  }

  // Локальная разработка в Safari без Telegram: "dev <telegramId>"
  if (scheme === AUTH_SCHEME.DEV && env.devAuth) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) throw new AuthError('Неверный dev id');
    const user: TelegramUser = { id, first_name: `Dev ${id}` };
    return { user, authDate: new Date(), startParam: undefined };
  }

  throw new AuthError('Неизвестная схема авторизации');
};

// Создаём пользователя при первом входе, обновляем имя/аватар при следующих
export const upsertTelegramUser = (prisma: PrismaClient, tg: TelegramUser) => {
  const profile = {
    firstName: tg.first_name,
    lastName: tg.last_name ?? null,
    username: tg.username ?? null,
    photoUrl: tg.photo_url ?? null,
    languageCode: tg.language_code ?? null,
  };
  return prisma.user.upsert({
    where: { telegramId: BigInt(tg.id) },
    update: profile,
    create: { telegramId: BigInt(tg.id), ...profile },
  });
};

export const isAdmin = (user: User) =>
  env.adminTelegramId !== null && user.telegramId === env.adminTelegramId;

export const authPlugin = fp(async (app: FastifyInstance, opts: { prisma: PrismaClient }) => {
  app.decorateRequest('user', null as unknown as User);

  app.addHook('preHandler', async (request: FastifyRequest, reply) => {
    try {
      const data = parseAuthHeader(request.headers.authorization);
      const user = await upsertTelegramUser(opts.prisma, data.user);
      if (user.isBanned) return reply.code(403).send({ error: 'Доступ заблокирован' });
      request.user = user;
      request.startParam = data.startParam;
    } catch (err) {
      if (err instanceof AuthError) {
        // Логируем только причину — без самих initData
        request.log.warn({ reason: err.message }, 'auth failed');
        return reply.code(401).send({ error: 'Не авторизован' });
      }
      throw err;
    }
  });
});
