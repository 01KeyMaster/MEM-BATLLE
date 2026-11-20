// pnpm dev:tg — открывает игру для телефона одной командой:
// 1) запускает туннель cloudflared к localhost:5173
// 2) ловит https-адрес и записывает его в .env (WEB_APP_URL)
// 3) настраивает бота: кнопка «Играть», команды, описание
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { BOT_TOKEN, BOT_USERNAME, ENV_PATH } from './config.ts';
import { configureBot } from './setup.ts';

const URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

// Меняем строку WEB_APP_URL=... в .env (или добавляем, если её нет)
const saveUrlToEnv = (url: string) => {
  const content = readFileSync(ENV_PATH, 'utf8');
  const line = `WEB_APP_URL=${url}`;
  const updated = /^WEB_APP_URL=.*$/m.test(content)
    ? content.replace(/^WEB_APP_URL=.*$/m, line)
    : `${content.trimEnd()}\n${line}\n`;
  writeFileSync(ENV_PATH, updated);
};

const cloudflared = spawn(
  process.env.CLOUDFLARED_BIN ?? 'cloudflared',
  ['tunnel', '--url', 'http://localhost:5173'],
);

cloudflared.on('error', () => {
  console.error('❌ cloudflared не найден. Установи: brew install cloudflared');
  process.exit(1);
});

let found = false;

// cloudflared пишет адрес в stderr
const onOutput = async (chunk: Buffer) => {
  const url = chunk.toString().match(URL_RE)?.[0];
  if (!url || found) return;
  found = true;

  saveUrlToEnv(url);
  console.log(`\n🌍 Туннель: ${url}`);
  console.log('📝 Адрес записан в .env (WEB_APP_URL)');

  try {
    await configureBot(BOT_TOKEN, url);
    console.log('🤖 Бот настроен: кнопка «Играть», команды, описание');
    console.log(`\n📱 Открой на телефоне @${BOT_USERNAME} → кнопка «Играть» слева от поля ввода`);
    console.log('   Не закрывай этот терминал — без него туннель отключится.\n');
  } catch (err) {
    console.error('❌ Не удалось настроить бота:', err instanceof Error ? err.message : err);
    console.error('   Проверь BOT_TOKEN в .env');
  }
};

cloudflared.stdout.on('data', onOutput);
cloudflared.stderr.on('data', onOutput);

const stop = () => cloudflared.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
cloudflared.on('exit', (code) => process.exit(code ?? 0));
