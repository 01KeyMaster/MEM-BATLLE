// Загружаем .env из корня монорепо и собираем настройки в один объект.
import path from 'node:path';
import { config } from 'dotenv';

export const ROOT_DIR = path.resolve(import.meta.dirname, '../../..');
config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

export const env = {
  port: Number(process.env.API_PORT ?? 3000),
  uploadsDir: path.resolve(ROOT_DIR, process.env.UPLOADS_DIR ?? 'uploads'),
};
