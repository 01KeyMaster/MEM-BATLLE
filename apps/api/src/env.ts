// Загружаем .env из корня монорепо и собираем настройки в один объект.
import path from 'node:path';
import { config } from 'dotenv';

export const ROOT_DIR = path.resolve(import.meta.dirname, '../../..');
config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Не задана переменная ${name} в .env`);
  return value;
};

const isProduction = process.env.NODE_ENV === 'production';
const devAuth = process.env.DEV_AUTH === 'true';

// Защита от ошибки: dev-вход без Telegram нельзя включить на боевом сервере
if (isProduction && devAuth) {
  throw new Error('DEV_AUTH=true запрещён при NODE_ENV=production');
}

export const env = {
  isProduction,
  port: Number(process.env.API_PORT ?? 3000),
  uploadsDir: path.resolve(ROOT_DIR, process.env.UPLOADS_DIR ?? 'uploads'),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  botToken: required('BOT_TOKEN'),
  adminTelegramId: process.env.ADMIN_TELEGRAM_ID ? BigInt(process.env.ADMIN_TELEGRAM_ID) : null,
  devAuth,
};
