// Все запросы к API идут через эту функцию — она добавляет авторизацию.
import { AUTH_SCHEME } from '@meme/shared';
import { isInTelegram, tg } from './telegram.ts';

// В Safari можно открыть несколько вкладок с ?dev=1, ?dev=2, ?dev=3 — это разные игроки
const DEV_TELEGRAM_ID =
  new URLSearchParams(window.location.search).get('dev') ??
  (import.meta.env.VITE_DEV_TELEGRAM_ID as string | undefined);

// Строка авторизации — для HTTP-заголовка и первого сообщения WebSocket
export const authHeader = () => {
  if (isInTelegram && tg) return `${AUTH_SCHEME.TELEGRAM} ${tg.initData}`;
  // В Safari без Telegram — dev-вход (сервер примет его, только если DEV_AUTH=true)
  if (import.meta.env.DEV && DEV_TELEGRAM_ID) return `${AUTH_SCHEME.DEV} ${DEV_TELEGRAM_ID}`;
  return '';
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const api = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? `Ошибка ${res.status}`);
  }
  return res.json() as Promise<T>;
};
