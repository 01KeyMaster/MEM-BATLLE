// Ссылка-приглашение в комнату и отправка её друзьям через Telegram.
import type { AppConfigDto } from '@meme/shared';
import { api } from './api.ts';
import { tg } from './telegram.ts';

let configPromise: Promise<AppConfigDto> | null = null;
const getConfig = () => (configPromise ??= api<AppConfigDto>('/config'));

export const roomInviteLink = async (code: string) => {
  const { botUsername, miniAppShortName } = await getConfig();
  // С Mini App из BotFather — сразу в комнату; без него — через /start бота
  return miniAppShortName
    ? `https://t.me/${botUsername}/${miniAppShortName}?startapp=${code}`
    : `https://t.me/${botUsername}?start=${code}`;
};

export const shareRoom = async (code: string) => {
  const link = await roomInviteLink(code);
  const text = 'Го в Мем-батл! Заходи в мою комнату 🃏';
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;

  if (tg?.initData) {
    tg.openTelegramLink(shareUrl); // откроет выбор чата в Telegram
    return 'shared';
  }
  // В обычном браузере — копируем ссылку
  await navigator.clipboard.writeText(link);
  return 'copied';
};
