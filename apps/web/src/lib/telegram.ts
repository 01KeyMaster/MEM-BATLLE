// Тонкая обёртка над window.Telegram.WebApp — только то, что нам нужно.

type TelegramWebApp = {
  initData: string; // подписанная строка — отправляем на сервер
  initDataUnsafe: {
    // НЕ проверено! Только для отображения, решения принимает сервер
    user?: { id: number; first_name: string };
    start_param?: string;
  };
  colorScheme: 'light' | 'dark';
  ready: () => void;
  expand: () => void;
  openTelegramLink: (url: string) => void;
  HapticFeedback?: { impactOccurred: (style: 'light' | 'medium' | 'heavy') => void };
};

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export const tg = window.Telegram?.WebApp;

// Открыто ли приложение внутри Telegram (в Safari initData пустой)
export const isInTelegram = Boolean(tg?.initData);

// Параметр из ссылки t.me/<bot>/<app>?startapp=...
export const startParam = tg?.initDataUnsafe.start_param;

export const initTelegram = () => {
  tg?.ready();  // говорим Telegram, что приложение загрузилось
  tg?.expand(); // разворачиваем на весь экран
};

export const haptic = (style: 'light' | 'medium' | 'heavy' = 'light') =>
  tg?.HapticFeedback?.impactOccurred(style);
