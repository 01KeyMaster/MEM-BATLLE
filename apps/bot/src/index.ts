// Бот @mem_fight_bot: /start и кнопка открытия Mini App.
// Платежи и рефералки добавим на этапах 7–8.
import { Bot, InlineKeyboard } from 'grammy';
import { BOT_TOKEN, BOT_USERNAME, MINI_APP_SHORT_NAME, currentWebAppUrl } from './config.ts';

// Разрешаем в параметре только безопасные символы (как требует Telegram)
const cleanParam = (raw: string) => (/^[A-Za-z0-9_-]{1,64}$/.test(raw) ? raw : undefined);

// Кнопка «Играть»:
// - если Mini App создан в BotFather — прямая ссылка t.me/<bot>/<app>?startapp=...
// - иначе (разработка) — открываем адрес туннеля напрямую
const playButton = (param?: string) => {
  if (MINI_APP_SHORT_NAME) {
    const base = `https://t.me/${BOT_USERNAME}/${MINI_APP_SHORT_NAME}`;
    return new InlineKeyboard().url('🎮 Играть', param ? `${base}?startapp=${param}` : base);
  }
  const url = currentWebAppUrl();
  if (url.startsWith('https://')) {
    // Без /newapp параметр передаём в адресе: Mini App прочитает ?room=...
    const target = new URL(url);
    if (param) target.searchParams.set('room', param);
    return new InlineKeyboard().webApp(param ? '🎮 Войти в комнату' : '🎮 Играть', target.toString());
  }
  return undefined;
};

const bot = new Bot(BOT_TOKEN);

// /start или /start <параметр> — например, ссылка-приглашение в комнату
bot.command('start', async (ctx) => {
  const keyboard = playButton(cleanParam(ctx.match));
  await ctx.reply(
    'Привет! Это «Мем-батл» 🃏\n\n' +
      'Собирай колоду мемов, зови друзей и выясняйте, чей мем смешнее.' +
      (keyboard ? '' : '\n\n⚙️ Игра пока не доступна: запусти pnpm dev:tg'),
    { reply_markup: keyboard },
  );
});

bot.catch((err) => {
  // Пишем только описание ошибки — без содержимого апдейта
  console.error('Ошибка бота:', err.error instanceof Error ? err.error.message : err.error);
});

const stop = () => bot.stop();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

// Локально — long polling (туннель для бота не нужен)
console.log(`🤖 Бот @${BOT_USERNAME} запущен`);
await bot.start({ drop_pending_updates: true });
