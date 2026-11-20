import { z } from 'zod';

// Что API отдаёт клиенту о текущем пользователе (GET /api/me)
export const MeSchema = z.object({
  id: z.string(),
  telegramId: z.string(), // BigInt превращаем в строку — JSON не умеет BigInt
  firstName: z.string(),
  username: z.string().nullable(),
  photoUrl: z.string().nullable(),
  isAdmin: z.boolean(),
  stats: z.object({
    gamesPlayed: z.number(),
    gamesWon: z.number(),
    roundsWon: z.number(),
  }),
});
export type Me = z.infer<typeof MeSchema>;

// Схема заголовка авторизации: "tma <initData>" (из Telegram)
// или "dev <telegramId>" (только локальная разработка)
export const AUTH_SCHEME = {
  TELEGRAM: 'tma',
  DEV: 'dev',
} as const;
