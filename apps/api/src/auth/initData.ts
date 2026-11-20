// Проверка подписи initData от Telegram.
// Документация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
import { createHmac, timingSafeEqual } from 'node:crypto';

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
};

export type ValidInitData = {
  user: TelegramUser;
  authDate: Date;
  startParam?: string;
};

export class InitDataError extends Error {}

// Сколько живёт initData. Telegram выдаёт новую строку при каждом открытии Mini App.
const MAX_AGE_SECONDS = 24 * 60 * 60;

export const validateInitData = (
  initData: string,
  botToken: string,
  now = Date.now(),
): ValidInitData => {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new InitDataError('Нет подписи hash');

  // 1. Собираем строку для проверки: все поля, кроме hash, по алфавиту, через \n
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // 2. Секретный ключ = HMAC_SHA256(токен бота, ключ "WebAppData")
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secretKey).update(dataCheckString).digest();

  // 3. Сравниваем за постоянное время, чтобы нельзя было подобрать подпись по таймингу
  const received = Buffer.from(hash, 'hex');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new InitDataError('Неверная подпись');
  }

  // 4. Проверяем свежесть
  const authDate = Number(params.get('auth_date'));
  if (!authDate || now / 1000 - authDate > MAX_AGE_SECONDS) {
    throw new InitDataError('initData устарел');
  }

  const userRaw = params.get('user');
  if (!userRaw) throw new InitDataError('Нет данных пользователя');
  const user = JSON.parse(userRaw) as TelegramUser;
  if (typeof user.id !== 'number' || !user.first_name) {
    throw new InitDataError('Некорректный пользователь');
  }

  return {
    user,
    authDate: new Date(authDate * 1000),
    startParam: params.get('start_param') ?? undefined,
  };
};

// Для тестов: собирает initData с правильной подписью (как это делает Telegram)
export const signInitData = (fields: Record<string, string>, botToken: string) => {
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
};
