// Настройка бота через Bot API — вместо ручных команд в @BotFather.
import { Api } from 'grammy';

export const configureBot = async (token: string, webAppUrl: string) => {
  const api = new Api(token);

  // Кнопка «Играть» слева от поля ввода — открывает Mini App
  await api.setChatMenuButton({
    menu_button: { type: 'web_app', text: 'Играть', web_app: { url: webAppUrl } },
  });

  // Список команд (меню «/»)
  await api.setMyCommands([{ command: 'start', description: 'Начать игру' }]);

  // Текст «Что умеет этот бот?» на пустом чате
  await api.setMyDescription(
    'Мем-батл: собирай колоду мемов и сражайся с друзьями, чей мем смешнее 🃏',
  );

  // Короткое описание в профиле бота
  await api.setMyShortDescription('Карточная битва мемов с друзьями');
};
