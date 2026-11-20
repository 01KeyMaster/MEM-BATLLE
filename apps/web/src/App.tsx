import { useEffect, useState } from 'react';
import { REF_PREFIX, type Me } from '@meme/shared';
import { api, ApiError } from './lib/api.ts';
import { showBackButton, startParam } from './lib/telegram.ts';
import { HomeScreen } from './screens/HomeScreen.tsx';
import { DeckScreen } from './screens/DeckScreen.tsx';
import { RoomScreen } from './screens/RoomScreen.tsx';

export type Screen = { name: 'home' } | { name: 'deck' } | { name: 'room'; code: string };

// Открыли по ссылке-приглашению → сразу в комнату (ref_… — это рефералка, этап 8)
const initialScreen = (): Screen =>
  startParam && !startParam.startsWith(REF_PREFIX) && /^[A-Za-z0-9]{4,16}$/.test(startParam)
    ? { name: 'room', code: startParam }
    : { name: 'home' };

export const App = () => {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const goHome = () => setScreen({ name: 'home' });

  // При запуске узнаём, кто мы. Сервер проверит initData и создаст пользователя.
  useEffect(() => {
    api<Me>('/me')
      .then(setMe)
      .catch((err) => {
        setError(err instanceof ApiError && err.status === 401
          ? 'Открой игру через бота @mem_fight_bot в Telegram'
          : 'Не удалось подключиться к серверу');
      });
  }, []);

  // Кнопка «Назад» Telegram — на экране колоды (в комнате выход — своими кнопками)
  useEffect(() => {
    if (screen.name !== 'deck') return;
    return showBackButton(goHome);
  }, [screen.name]);

  if (error) return <p className="p-6 text-center text-hint">{error}</p>;
  if (!me) return <p className="p-6 text-center text-hint">Загрузка…</p>;

  switch (screen.name) {
    case 'deck':
      return (
        <>
          <BrowserBack onBack={goHome} />
          <DeckScreen />
        </>
      );
    case 'room':
      return <RoomScreen key={screen.code} code={screen.code} onExit={goHome} />;
    default:
      return <HomeScreen me={me} onNavigate={setScreen} />;
  }
};

// В Safari нет кнопки «Назад» Telegram — показываем свою
const BrowserBack = ({ onBack }: { onBack: () => void }) =>
  window.Telegram?.WebApp.initData ? null : (
    <button onClick={onBack} className="px-4 pt-3 text-sm text-accent">
      ← Назад
    </button>
  );
