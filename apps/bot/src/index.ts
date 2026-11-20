// Бот @mem_fight_bot: /start и кнопка открытия Mini App.
// Платежи и рефералки добавим на этапах 7–8.
import path from 'node:path';
import { config } from 'dotenv';
import { Bot, InlineKeyboard } from 'grammy';

config({ path: path.resolve(import.meta.dirname, '../../../.env'), quiet: true });

const { BOT_TOKEN, BOT_USERNAME, MINI_APP_SHORT_NAME, WEB_APP_URL } = process.env;
if (!BOT_TOKEN) throw new Error('Не задан BOT_TOKEN в .env');
if (!BOT_USERNAME || !MINI_APP_SHORT_NAME) {
  throw new Error('Заполни BOT_USERNAME и MINI_APP_SHORT_NAME в .env');
}

// Прямая ссылка на Mini App. startapp передаётся в приложение как start_param.
const miniAppLink = (startParam?: string) => {
  const base = `https://t.me/${BOT_USERNAME}/${MINI_APP_SHORT_NAME}`;
  return startParam ? `${base}?startapp=${encodeURIComponent(startParam)}` : base;
};

// Разрешаем в параметре только безопасные символы (как требует Telegram)
const cleanParam = (raw: string) => (/^[A-Za-z0-9_-]{1,64}$/.test(raw) ? raw : undefined);

const bot = new Bot(BOT_TOKEN);

// /start или /start <параметр> — например, ссылка-приглашение в комнату
bot.command('start', async (ctx) => {
  const param = cleanParam(ctx.match);
  const keyboard = new InlineKeyboard().url('🎮 Играть', miniAppLink(param));

  await ctx.reply(
    'Привет! Это «Мем-батл» 🃏\n\n' +
      'Собирай колоду мемов, зови друзей и выясняйте, чей мем смешнее.',
    { reply_markup: keyboard },
  );
});

bot.catch((err) => {
  // Пишем только описание ошибки — без содержимого апдейта
  console.error('Ошибка бота:', err.error instanceof Error ? err.error.message : err.error);
});

// Кнопка «Играть» слева от поля ввода. Нужен https-адрес фронтенда.
if (WEB_APP_URL?.startsWith('https://')) {
  await bot.api.setChatMenuButton({
    menu_button: { type: 'web_app', text: 'Играть', web_app: { url: WEB_APP_URL } },
  });
}

const stop = () => bot.stop();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

// Локально — long polling (туннель для бота не нужен)
console.log(`🤖 Бот @${BOT_USERNAME} запущен`);
await bot.start({ drop_pending_updates: true });
