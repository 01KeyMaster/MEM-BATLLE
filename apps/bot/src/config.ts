// Настройки бота. WEB_APP_URL перечитываем из .env при каждом обращении:
// адрес туннеля меняется, а перезапускать бота ради этого не хочется.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { config, parse } from 'dotenv';

export const ENV_PATH = path.resolve(import.meta.dirname, '../../../.env');
config({ path: ENV_PATH, quiet: true });

export const BOT_TOKEN = process.env.BOT_TOKEN ?? '';
export const BOT_USERNAME = process.env.BOT_USERNAME ?? '';
export const MINI_APP_SHORT_NAME = process.env.MINI_APP_SHORT_NAME ?? '';

if (!BOT_TOKEN) throw new Error('Не задан BOT_TOKEN в .env');

export const currentWebAppUrl = () => {
  try {
    return parse(readFileSync(ENV_PATH)).WEB_APP_URL ?? '';
  } catch {
    return process.env.WEB_APP_URL ?? '';
  }
};
