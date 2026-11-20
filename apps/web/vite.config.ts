import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // .env лежит в корне монорепо; в браузер попадают только переменные с префиксом VITE_
  envDir: '../..',
  server: {
    port: 5173,
    host: true,
    // Разрешаем открывать dev-сервер через туннель cloudflared (для теста в Telegram)
    allowedHosts: ['.trycloudflare.com'],
    // Запросы к API идут через Vite — так хватает одного туннеля
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
});
